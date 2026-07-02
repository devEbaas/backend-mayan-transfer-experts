import { Test, TestingModule } from '@nestjs/testing';
import { Place, Prisma, Vehicle } from '@prisma/client';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let repository: jest.Mocked<CatalogRepository>;

  const cun: Place = {
    id: 'place-cun',
    key: 'cun',
    labelEs: 'Aeropuerto de Cancún (CUN)',
    labelEn: 'Cancún Airport (CUN)',
    zone: 'Cancún',
    isAirport: true,
    isPopular: false,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hotelzone: Place = {
    ...cun,
    id: 'place-hotelzone',
    key: 'hotelzone',
    labelEs: 'Zona Hotelera',
    labelEn: 'Hotel Zone',
    isAirport: false,
    isPopular: true,
  };

  const van: Vehicle = {
    id: 'vehicle-van',
    name: 'Private Van',
    capacityPassengers: 8,
    capacityLuggage: 8,
    description: 'Hasta 8 pasajeros',
    imageUrl: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: CatalogRepository,
          useValue: {
            findActivePlaces: jest.fn(),
            findRatesForRoute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CatalogService);
    repository = module.get(CatalogRepository);
  });

  it('returns active places as plain entities', async () => {
    repository.findActivePlaces.mockResolvedValue([cun, hotelzone]);

    const result = await service.getRoutes();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: 'cun' });
  });

  it('returns vehicles with numeric prices for a route', async () => {
    repository.findRatesForRoute.mockResolvedValue([
      {
        id: 'rate-1',
        originId: cun.id,
        destinationId: hotelzone.id,
        vehicleId: van.id,
        season: null,
        currency: 'USD',
        priceNormal: new Prisma.Decimal('89.60'),
        pricePromo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: van,
      },
    ]);

    const result = await service.getVehiclesForRoute({
      originId: cun.id,
      destinationId: hotelzone.id,
    });

    expect(repository.findRatesForRoute.mock.calls[0]).toEqual([
      cun.id,
      hotelzone.id,
    ]);
    expect(result).toEqual([
      {
        vehicleId: van.id,
        name: van.name,
        capacityPassengers: van.capacityPassengers,
        capacityLuggage: van.capacityLuggage,
        description: van.description,
        imageUrl: van.imageUrl,
        rateId: 'rate-1',
        currency: 'USD',
        priceNormal: 89.6,
        pricePromo: null,
      },
    ]);
  });

  it('returns an empty list when there are no rates for the route', async () => {
    repository.findRatesForRoute.mockResolvedValue([]);

    const result = await service.getVehiclesForRoute({
      originId: cun.id,
      destinationId: 'unknown',
    });

    expect(result).toEqual([]);
  });
});
