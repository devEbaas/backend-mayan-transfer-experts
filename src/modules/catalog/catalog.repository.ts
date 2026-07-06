import { Injectable } from '@nestjs/common';
import { Extra, Place, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivePlaces(): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: { active: true },
      orderBy: [{ isAirport: 'desc' }, { labelEs: 'asc' }],
    });
  }

  findActiveExtras(): Promise<Extra[]> {
    return this.prisma.extra.findMany({
      where: { active: true },
      orderBy: { labelEs: 'asc' },
    });
  }

  findRatesForRoute(
    originId: string,
    destinationId: string,
  ): Promise<Prisma.RateGetPayload<{ include: { vehicle: true } }>[]> {
    return this.prisma.rate.findMany({
      where: {
        originId,
        destinationId,
        season: null,
        vehicle: { active: true },
      },
      include: { vehicle: true },
      orderBy: { priceNormal: 'asc' },
    });
  }
}
