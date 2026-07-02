import { Injectable } from '@nestjs/common';
import {
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface CreatePaymentInput {
  bookingId: string;
  provider: PaymentProvider;
  providerRef: string;
  amount: Prisma.Decimal | number;
  currency: string;
  status: PaymentStatus;
  raw: Prisma.InputJsonValue;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stripe PaymentIntent creation is called with an idempotency key, so a retried
   * request resolves to the same providerRef — upsert avoids a duplicate-key crash.
   */
  upsertByProviderRef(input: CreatePaymentInput): Promise<Payment> {
    return this.prisma.payment.upsert({
      where: {
        provider_providerRef: {
          provider: input.provider,
          providerRef: input.providerRef,
        },
      },
      create: input,
      update: {
        amount: input.amount,
        currency: input.currency,
        raw: input.raw,
      },
    });
  }

  findByProviderRef(
    provider: PaymentProvider,
    providerRef: string,
  ): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { provider_providerRef: { provider, providerRef } },
    });
  }

  updateStatus(
    id: string,
    status: PaymentStatus,
    raw: Prisma.InputJsonValue,
  ): Promise<Payment> {
    return this.prisma.payment.update({ where: { id }, data: { status, raw } });
  }
}
