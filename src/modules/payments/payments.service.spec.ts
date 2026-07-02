import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { BookingEntity } from '../bookings/entities/booking.entity';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const paymentIntentsCreate = jest.fn();
const webhooksConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: { create: paymentIntentsCreate },
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
    priceTotal: 89.6,
    currency: 'USD',
    status: BookingStatus.nueva,
  } as BookingEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'stripe.secretKey' ? 'sk_test_123' : 'whsec_test',
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

  describe('createStripeIntent', () => {
    it('creates a PaymentIntent, persists the payment and marks the booking as awaiting payment', async () => {
      findBookingById.mockResolvedValue(booking);
      paymentIntentsCreate.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret',
      });
      upsertByProviderRef.mockResolvedValue({ id: 'payment-1' });

      const result = await service.createStripeIntent({
        bookingId: booking.id,
      });

      expect(paymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 8960, currency: 'usd' }),
        { idempotencyKey: `booking-${booking.id}-stripe-intent` },
      );
      expect(upsertByProviderRef).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: booking.id,
          provider: PaymentProvider.stripe,
          providerRef: 'pi_123',
          status: PaymentStatus.pending,
        }),
      );
      expect(markAwaitingPayment).toHaveBeenCalledWith(booking.id);
      expect(result).toEqual({
        clientSecret: 'pi_123_secret',
        paymentId: 'payment-1',
      });
    });

    it('rejects bookings that are no longer awaiting payment', async () => {
      findBookingById.mockResolvedValue({
        ...booking,
        status: BookingStatus.confirmada,
      });

      await expect(
        service.createStripeIntent({ bookingId: booking.id }),
      ).rejects.toThrow(ConflictException);
      expect(paymentIntentsCreate).not.toHaveBeenCalled();
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
    const intent = { id: 'pi_123' } as Stripe.PaymentIntent;

    it('confirms the booking when a payment succeeds', async () => {
      findByProviderRef.mockResolvedValue({
        id: 'payment-1',
        bookingId: booking.id,
      });

      await service.handleStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: intent },
      } as Stripe.Event);

      expect(updateStatus).toHaveBeenCalledWith(
        'payment-1',
        PaymentStatus.succeeded,
        expect.anything(),
      );
      expect(markPaymentSucceeded).toHaveBeenCalledWith(booking.id);
      expect(markPaymentFailed).not.toHaveBeenCalled();
    });

    it('marks the booking payment as failed on a failed charge', async () => {
      findByProviderRef.mockResolvedValue({
        id: 'payment-1',
        bookingId: booking.id,
      });

      await service.handleStripeEvent({
        type: 'payment_intent.payment_failed',
        data: { object: intent },
      } as Stripe.Event);

      expect(markPaymentFailed).toHaveBeenCalledWith(booking.id);
      expect(markPaymentSucceeded).not.toHaveBeenCalled();
    });

    it('ignores events for an unknown PaymentIntent', async () => {
      findByProviderRef.mockResolvedValue(null);

      await service.handleStripeEvent({
        type: 'payment_intent.succeeded',
        data: { object: intent },
      } as Stripe.Event);

      expect(updateStatus).not.toHaveBeenCalled();
      expect(markPaymentSucceeded).not.toHaveBeenCalled();
    });

    it('ignores unrelated event types', async () => {
      await service.handleStripeEvent({
        type: 'charge.refunded',
        data: { object: intent },
      } as unknown as Stripe.Event);

      expect(findByProviderRef).not.toHaveBeenCalled();
    });
  });
});
