import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  ContactPref,
  PayMethod,
  Prisma,
  TripType,
  Vehicle,
} from '@prisma/client';
import { BookingsRepository, BookingWithExtras } from './bookings.repository';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;

  const createWithPriceSnapshot = jest.fn();
  const findById = jest.fn();
  const updateStatus = jest.fn();

  const van: Vehicle = {
    id: 'vehicle-van',
    name: 'Private Van',
    capacityPassengers: 8,
    capacityLuggage: 8,
    description: null,
    imageUrl: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const booking: BookingWithExtras = {
    id: 'booking-1',
    folio: 'CTH-7K2940',
    tripType: TripType.oneway,
    originId: 'place-cun',
    destinationId: 'place-hotelzone',
    arrivalDate: new Date('2026-08-01'),
    departureDate: null,
    adults: 2,
    children: 0,
    vehicleId: 'vehicle-van',
    priceTotal: new Prisma.Decimal('89.60'),
    currency: 'USD',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+1 555 000 1234',
    contactPref: ContactPref.whatsapp,
    arrivalAirline: 'AA',
    arrivalFlightNo: 'AA123',
    arrivalTime: '14:30',
    departureAirline: null,
    departureFlightNo: null,
    departureTime: null,
    comments: null,
    payMethod: PayMethod.card,
    paymentStatus: 'pending',
    status: BookingStatus.nueva,
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicle: van,
    extras: [],
  };

  const baseDto = {
    tripType: TripType.oneway,
    originId: booking.originId,
    destinationId: booking.destinationId,
    vehicleId: booking.vehicleId,
    arrivalDate: '2026-08-01',
    adults: 2,
    children: 0,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+1 555 000 1234',
    contactPref: ContactPref.whatsapp,
    payMethod: PayMethod.card,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingsRepository,
          useValue: { createWithPriceSnapshot, findById, updateStatus },
        },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('creates a one-way booking and maps it to an entity', async () => {
    createWithPriceSnapshot.mockResolvedValue(booking);

    const result = await service.create(baseDto);

    expect(createWithPriceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tripType: TripType.oneway,
        departureDate: null,
      }),
    );
    expect(result).toMatchObject({ folio: 'CTH-7K2940', priceTotal: 89.6 });
  });

  it('passes requested extras through to the repository', async () => {
    createWithPriceSnapshot.mockResolvedValue(booking);

    const extras = [{ extraId: 'extra-beer', qty: 2 }];
    await service.create({ ...baseDto, extras });

    expect(createWithPriceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ extras }),
    );
  });

  it('rejects a round trip without departureDate before touching the repository', async () => {
    await expect(
      service.create({ ...baseDto, tripType: TripType.round }),
    ).rejects.toThrow(BadRequestException);

    expect(createWithPriceSnapshot).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the booking does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('transitions status when the move is allowed', async () => {
    findById.mockResolvedValue(booking);
    updateStatus.mockResolvedValue({
      ...booking,
      status: BookingStatus.pendiente_pago,
    });

    const result = await service.transitionStatus(
      booking.id,
      BookingStatus.pendiente_pago,
    );

    expect(updateStatus).toHaveBeenCalledWith(
      booking.id,
      BookingStatus.pendiente_pago,
    );
    expect(result.status).toBe(BookingStatus.pendiente_pago);
  });

  it('rejects an invalid status transition', async () => {
    findById.mockResolvedValue(booking);

    await expect(
      service.transitionStatus(booking.id, BookingStatus.finalizada),
    ).rejects.toThrow();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
