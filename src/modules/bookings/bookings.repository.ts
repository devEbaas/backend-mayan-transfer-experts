import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  ContactPref,
  PayMethod,
  Prisma,
  TripType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { generateFolio } from './utils/folio.util';

const MAX_FOLIO_ATTEMPTS = 5;

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
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithPriceSnapshot(input: CreateBookingInput): Promise<Booking> {
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

          return tx.booking.create({
            data: {
              ...input,
              folio: generateFolio(),
              priceTotal: rate.pricePromo ?? rate.priceNormal,
              currency: rate.currency,
            },
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

  findById(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return this.prisma.booking.update({ where: { id }, data: { status } });
  }
}
