import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import Stripe from 'stripe';
import { AppConfig } from '../../config/config.type';
import { BookingsService } from '../bookings/bookings.service';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { PaymentIntentEntity } from './entities/payment-intent.entity';
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
  }

  async createStripeIntent(
    dto: CreateStripeIntentDto,
  ): Promise<PaymentIntentEntity> {
    const booking = await this.bookingsService.findById(dto.bookingId);

    if (!BOOKING_AWAITING_PAYMENT_STATUSES.includes(booking.status)) {
      throw new ConflictException(
        `Booking ${booking.id} is not awaiting payment (status: ${booking.status})`,
      );
    }

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(booking.priceTotal * 100),
        currency: booking.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: { bookingId: booking.id, folio: booking.folio },
      },
      { idempotencyKey: `booking-${booking.id}-stripe-intent` },
    );

    const payment = await this.paymentsRepository.upsertByProviderRef({
      bookingId: booking.id,
      provider: PaymentProvider.stripe,
      providerRef: intent.id,
      amount: booking.priceTotal,
      currency: booking.currency,
      status: PaymentStatus.pending,
      raw: intent as unknown as Prisma.InputJsonValue,
    });

    await this.bookingsService.markAwaitingPayment(booking.id);

    if (!intent.client_secret) {
      throw new ServiceUnavailableException(
        'Stripe did not return a client secret for the created PaymentIntent',
      );
    }

    return new PaymentIntentEntity({
      clientSecret: intent.client_secret,
      paymentId: payment.id,
    });
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
      case 'payment_intent.succeeded':
        await this.syncPaymentOutcome(
          event.data.object,
          PaymentStatus.succeeded,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.syncPaymentOutcome(event.data.object, PaymentStatus.failed);
        break;
      default:
        this.logger.debug(`Ignoring unhandled Stripe event: ${event.type}`);
    }
  }

  private async syncPaymentOutcome(
    intent: Stripe.PaymentIntent,
    status: PaymentStatus,
  ): Promise<void> {
    const payment = await this.paymentsRepository.findByProviderRef(
      PaymentProvider.stripe,
      intent.id,
    );

    if (!payment) {
      this.logger.warn(
        `Received Stripe event for unknown PaymentIntent ${intent.id}`,
      );
      return;
    }

    await this.paymentsRepository.updateStatus(
      payment.id,
      status,
      intent as unknown as Prisma.InputJsonValue,
    );

    if (status === PaymentStatus.succeeded) {
      await this.bookingsService.markPaymentSucceeded(payment.bookingId);
    } else {
      await this.bookingsService.markPaymentFailed(payment.bookingId);
    }
  }
}
