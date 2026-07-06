import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Booking,
  BookingExtra,
  BookingStatus,
  ContactPref,
  Extra,
  PayMethod,
  PaymentStatus,
  Prisma,
  TripType,
  Vehicle,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { generateFolio } from './utils/folio.util';

const MAX_FOLIO_ATTEMPTS = 5;

const bookingInclude = {
  extras: { include: { extra: true } },
  vehicle: true,
} satisfies Prisma.BookingInclude;

export type BookingWithExtras = Booking & {
  extras: (BookingExtra & { extra: Extra })[];
  vehicle: Vehicle;
};

export interface CreateBookingInput {
  tripType: TripType;
  originId: string;
  destinationId: string;
  vehicleId: string;
  arrivalDate: Date;
  departureDate: Date | null;
  adults: number;
  children: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactPref: ContactPref;
  arrivalAirline?: string;
  arrivalFlightNo?: string;
  arrivalTime?: string;
  departureAirline?: string;
  departureFlightNo?: string;
  departureTime?: string;
  comments?: string;
  payMethod: PayMethod;
  extras?: { extraId: string; qty: number }[];
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithPriceSnapshot(
    input: CreateBookingInput,
  ): Promise<BookingWithExtras> {
    const { extras: requestedExtras, ...bookingFields } = input;

    for (let attempt = 1; attempt <= MAX_FOLIO_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const rate = await tx.rate.findFirst({
            where: {
              originId: input.originId,
              destinationId: input.destinationId,
              vehicleId: input.vehicleId,
              season: null,
              vehicle: { active: true },
            },
          });

          if (!rate) {
            throw new NotFoundException(
              'No rate available for the selected route and vehicle',
            );
          }

          const vehiclePrice = rate.pricePromo ?? rate.priceNormal;
          const currency = rate.currency;
          let extrasTotal = new Prisma.Decimal(0);
          let extraLines: {
            extraId: string;
            qty: number;
            unitPrice: Prisma.Decimal;
            currency: string;
          }[] = [];

          if (requestedExtras && requestedExtras.length > 0) {
            const extraIds = requestedExtras.map((e) => e.extraId);
            const uniqueExtraIds = new Set(extraIds);
            if (uniqueExtraIds.size !== extraIds.length) {
              throw new BadRequestException('Duplicate extraId in extras');
            }

            const extras = await tx.extra.findMany({
              where: { id: { in: extraIds }, active: true },
            });
            const extraById = new Map(extras.map((e) => [e.id, e]));

            for (const requested of requestedExtras) {
              const extra = extraById.get(requested.extraId);
              if (!extra) {
                throw new BadRequestException(
                  `Extra ${requested.extraId} not found or inactive`,
                );
              }
              if (requested.qty > extra.maxQty) {
                throw new BadRequestException(
                  `Quantity for extra ${extra.key} exceeds maxQty (${extra.maxQty})`,
                );
              }
              extrasTotal = extrasTotal.plus(
                extra.price.times(requested.qty),
              );
            }

            extraLines = requestedExtras.map((requested) => {
              const extra = extraById.get(requested.extraId)!;
              return {
                extraId: extra.id,
                qty: requested.qty,
                unitPrice: extra.price,
                currency: extra.currency,
              };
            });
          }

          return tx.booking.create({
            data: {
              ...bookingFields,
              folio: generateFolio(),
              priceTotal: vehiclePrice.plus(extrasTotal),
              currency,
              extras: { create: extraLines },
            },
            include: bookingInclude,
          });
        });
      } catch (error) {
        const isFolioCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (error.meta?.target as string[] | undefined)?.includes('folio');

        if (!isFolioCollision || attempt === MAX_FOLIO_ATTEMPTS) {
          throw error;
        }
      }
    }

    /* istanbul ignore next -- loop always returns or throws */
    throw new Error('Unreachable');
  }

  findById(id: string): Promise<BookingWithExtras | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
  }

  updateStatus(id: string, status: BookingStatus): Promise<BookingWithExtras> {
    return this.prisma.booking.update({
      where: { id },
      data: { status },
      include: bookingInclude,
    });
  }

  updatePaymentOutcome(
    id: string,
    data: { status?: BookingStatus; paymentStatus: PaymentStatus },
  ): Promise<BookingWithExtras> {
    return this.prisma.booking.update({
      where: { id },
      data,
      include: bookingInclude,
    });
  }
}
