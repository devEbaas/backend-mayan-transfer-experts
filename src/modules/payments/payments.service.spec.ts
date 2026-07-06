import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { BookingEntity } from '../bookings/entities/booking.entity';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const checkoutSessionsCreate = jest.fn();
const webhooksConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: checkoutSessionsCreate } },
    webhooks: { constructEvent: webhooksConstructEvent },
  }));
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  const upsertByProviderRef = jest.fn();
  const findByProviderRef = jest.fn();
  const updateStatus = jest.fn();
  const findBookingById = jest.fn();
  const markAwaitingPayment = jest.fn();
  const markPaymentSucceeded = jest.fn();
  const markPaymentFailed = jest.fn();

  const booking = {
    id: 'booking-1',
    folio: 'CTH-HW2NWQ',
    email: 'jane@example.com',
    priceTotal: 101.6,
    currency: 'USD',
    status: BookingStatus.nueva,
    vehicleName: 'Private Van',
    extras: [
      {
        extraId: 'extra-beer',
        labelEs: 'Cerveza (six-pack)',
        labelEn: 'Beer (6-pack)',
        qty: 1,
        unitPrice: 12,
        currency: 'USD',
      },
    ],
  } as BookingEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'stripe.secretKey') return 'sk_test_123';
              if (key === 'stripe.webhookSecret') return 'whsec_test';
              if (key === 'app.frontendUrl') return 'http://localhost:5173';
              return undefined;
            },
          },
        },
        {
          provide: PaymentsRepository,
          useValue: { upsertByProviderRef, findByProviderRef, updateStatus },
        },
        {
          provide: BookingsService,
          useValue: {
            findById: findBookingById,
            markAwaitingPayment,
            markPaymentSucceeded,
            markPaymentFailed,
          },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('createCheckoutSession', () => {
    it('creates a Checkout Session with itemized line items, persists the payment and marks the booking as awaiting payment', async () => {
      findBookingById.mockResolvedValue(booking);
      checkoutSessionsCreate.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/c/pay/cs_123',
      });
      upsertByProviderRef.mockResolvedValue({ id: 'payment-1' });

      const result = await service.createCheckoutSession({
        bookingId: booking.id,
      });

      expect(checkoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          line_items: [
            expect.objectContaining({
              quantity: 1,
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 8960,
                product_data: { name: 'Transfer Private Van' },
              }),
            }),
            expect.objectContaining({
              quantity: 1,
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 1200,
                product_data: { name: 'Beer (6-pack)' },
              }),
            }),
          ],
          success_url: expect.stringContaining('booking=success'),
          cancel_url: expect.stringContaining('booking=cancel'),
        }),
        { idempotencyKey: `booking-${booking.id}-checkout-session` },
      );
      expect(upsertByProviderRef).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: booking.id,
          provider: PaymentProvider.stripe,
          providerRef: 'cs_123',
          status: PaymentStatus.pending,
        }),
      );
      expect(markAwaitingPayment).toHaveBeenCalledWith(booking.id);
      expect(result).toEqual({
        url: 'https://checkout.stripe.com/c/pay/cs_123',
        sessionId: 'cs_123',
      });
    });

    it('rejects bookings that are no longer awaiting payment', async () => {
      findBookingById.mockResolvedValue({
        ...booking,
        status: BookingStatus.confirmada,
      });

      await expect(
        service.createCheckoutSession({ bookingId: booking.id }),
      ).rejects.toThrow(ConflictException);
      expect(checkoutSessionsCreate).not.toHaveBeenCalled();
    });
  });

  describe('constructStripeEvent', () => {
    it('rejects a missing signature', () => {
      expect(() =>
        service.constructStripeEvent(Buffer.from('{}'), undefined),
      ).toThrow(BadRequestException);
    });

    it('rejects an invalid signature', () => {
      webhooksConstructEvent.mockImplementation(() => {
        throw new Error('signature mismatch');
      });

      expect(() =>
        service.constructStripeEvent(Buffer.from('{}'), 'bad-signature'),
      ).toThrow(BadRequestException);
    });

    it('returns the verified event', () => {
      const event = { id: 'evt_1', type: 'payment_intent.succeeded' };
      webhooksConstructEvent.mockReturnValue(event);

      const result = service.constructStripeEvent(
        Buffer.from('{}'),
        'good-signature',
      );

      expect(result).toBe(event);
    });
  });

  describe('handleStripeEvent', () => {
    const session = { id: 'cs_123' } as Stripe.Checkout.Session;

    it('confirms the booking when a checkout session completes', async () => {
      findByProviderRef.mockResolvedValue({
        id: 'payment-1',
        bookingId: booking.id,
      });

      await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: session },
      } as Stripe.Event);

      expect(updateStatus).toHaveBeenCalledWith(
        'payment-1',
        PaymentStatus.succeeded,
        expect.anything(),
      );
      expect(markPaymentSucceeded).toHaveBeenCalledWith(booking.id);
      expect(markPaymentFailed).not.toHaveBeenCalled();
    });

    it('marks the booking payment as failed when a checkout session expires', async () => {
      findByProviderRef.mockResolvedValue({
        id: 'payment-1',
        bookingId: booking.id,
      });

      await service.handleStripeEvent({
        type: 'checkout.session.expired',
        data: { object: session },
      } as Stripe.Event);

      expect(markPaymentFailed).toHaveBeenCalledWith(booking.id);
      expect(markPaymentSucceeded).not.toHaveBeenCalled();
    });

    it('ignores events for an unknown Checkout Session', async () => {
      findByProviderRef.mockResolvedValue(null);

      await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: session },
      } as Stripe.Event);

      expect(updateStatus).not.toHaveBeenCalled();
      expect(markPaymentSucceeded).not.toHaveBeenCalled();
    });

    it('ignores unrelated event types', async () => {
      await service.handleStripeEvent({
        type: 'charge.refunded',
        data: { object: session },
      } as unknown as Stripe.Event);

      expect(findByProviderRef).not.toHaveBeenCalled();
    });
  });
});
