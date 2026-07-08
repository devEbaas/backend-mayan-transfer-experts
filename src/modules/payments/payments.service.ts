import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { AppConfig } from '../../config/config.type';
import { BookingEntity } from '../bookings/entities/booking.entity';
import { BookingsService } from '../bookings/bookings.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CheckoutSessionEntity } from './entities/checkout-session.entity';
import { PaymentsRepository } from './payments.repository';

const BOOKING_AWAITING_PAYMENT_STATUSES: BookingStatus[] = [
  BookingStatus.nueva,
  BookingStatus.pendiente_pago,
];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly bookingsService: BookingsService,
  ) {
    this.stripe = new Stripe(
      configService.get('stripe.secretKey', { infer: true }),
    );
    this.webhookSecret = configService.get('stripe.webhookSecret', {
      infer: true,
    });
    this.frontendUrl = configService.get('app.frontendUrl', { infer: true });
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionEntity> {
    const booking = await this.bookingsService.findById(dto.bookingId);

    if (!BOOKING_AWAITING_PAYMENT_STATUSES.includes(booking.status)) {
      throw new ConflictException(
        `Booking ${booking.id} is not awaiting payment (status: ${booking.status})`,
      );
    }

    const lineItems = this.buildLineItems(booking);

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        success_url: `${this.frontendUrl}/?session_id={CHECKOUT_SESSION_ID}&booking=success`,
        cancel_url: `${this.frontendUrl}/?booking=cancel`,
        client_reference_id: booking.id,
        customer_email: booking.email,
        metadata: { bookingId: booking.id, folio: booking.folio },
      },
      { idempotencyKey: `booking-${booking.id}-checkout-session` },
    );

    await this.paymentsRepository.upsertByProviderRef({
      bookingId: booking.id,
      provider: PaymentProvider.stripe,
      providerRef: session.id,
      amount: booking.priceTotal,
      currency: booking.currency,
      status: PaymentStatus.pending,
      raw: session as unknown as Prisma.InputJsonValue,
    });

    await this.bookingsService.markAwaitingPayment(booking.id);

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a URL for the created Checkout Session',
      );
    }

    return new CheckoutSessionEntity({
      url: session.url,
      sessionId: session.id,
    });
  }

  private buildLineItems(
    booking: BookingEntity,
  ): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const extrasTotal = booking.extras.reduce(
      (sum, line) => sum + line.unitPrice * line.qty,
      0,
    );
    const vehiclePrice = booking.priceTotal - extrasTotal;
    const currency = booking.currency.toLowerCase();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(vehiclePrice * 100),
          product_data: { name: `Transfer ${booking.vehicleName}` },
        },
      },
    ];

    for (const line of booking.extras) {
      lineItems.push({
        quantity: line.qty,
        price_data: {
          currency: line.currency.toLowerCase(),
          unit_amount: Math.round(line.unitPrice * 100),
          product_data: { name: line.labelEn },
        },
      });
    }

    return lineItems;
  }

  constructStripeEvent(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Stripe.Event {
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured',
      );
    }

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${(error as Error).message}`,
      );
    }
  }

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.payment_status === 'paid') {
          await this.syncPaymentOutcome(session, PaymentStatus.succeeded);
        } else {
          this.logger.debug(
            `Checkout Session ${session.id} completed with payment_status=${session.payment_status}; awaiting async payment confirmation`,
          );
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded':
        await this.syncPaymentOutcome(
          event.data.object,
          PaymentStatus.succeeded,
        );
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await this.syncPaymentOutcome(event.data.object, PaymentStatus.failed);
        break;
      default:
        this.logger.debug(`Ignoring unhandled Stripe event: ${event.type}`);
    }
  }

  private async syncPaymentOutcome(
    session: Stripe.Checkout.Session,
    status: PaymentStatus,
  ): Promise<void> {
    const payment = await this.paymentsRepository.findByProviderRef(
      PaymentProvider.stripe,
      session.id,
    );

    if (!payment) {
      this.logger.warn(
        `Received Stripe event for unknown Checkout Session ${session.id}`,
      );
      return;
    }

    await this.paymentsRepository.updateStatus(
      payment.id,
      status,
      session as unknown as Prisma.InputJsonValue,
    );

    if (status === PaymentStatus.succeeded) {
      await this.bookingsService.markPaymentSucceeded(payment.bookingId);
    } else {
      await this.bookingsService.markPaymentFailed(payment.bookingId);
    }
  }
}
