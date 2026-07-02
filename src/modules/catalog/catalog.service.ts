import { Injectable } from '@nestjs/common';
import { GetVehiclesQueryDto } from './dto/get-vehicles-query.dto';
import { PlaceEntity } from './entities/place.entity';
import { VehicleRateEntity } from './entities/vehicle-rate.entity';
import { CatalogRepository } from './catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async getRoutes(): Promise<PlaceEntity[]> {
    const places = await this.catalogRepository.findActivePlaces();
    return places.map((place) => new PlaceEntity(place));
  }

  async getVehiclesForRoute(
    query: GetVehiclesQueryDto,
  ): Promise<VehicleRateEntity[]> {
    const rates = await this.catalogRepository.findRatesForRoute(
      query.originId,
      query.destinationId,
    );

    return rates.map(
      (rate) =>
        new VehicleRateEntity({
          vehicleId: rate.vehicle.id,
          name: rate.vehicle.name,
          capacityPassengers: rate.vehicle.capacityPassengers,
          capacityLuggage: rate.vehicle.capacityLuggage,
          description: rate.vehicle.description,
          imageUrl: rate.vehicle.imageUrl,
          rateId: rate.id,
          currency: rate.currency,
          priceNormal: rate.priceNormal.toNumber(),
          pricePromo: rate.pricePromo?.toNumber() ?? null,
        }),
    );
  }
}
