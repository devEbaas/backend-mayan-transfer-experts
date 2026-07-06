import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, TripType } from '@prisma/client';
import { assertValidBookingTransition } from './booking-status.util';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingEntity } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

  async create(dto: CreateBookingDto): Promise<BookingEntity> {
    if (dto.tripType === TripType.round && !dto.departureDate) {
      throw new BadRequestException(
        'departureDate is required when tripType is "round"',
      );
    }

    const booking = await this.bookingsRepository.createWithPriceSnapshot({
      tripType: dto.tripType,
      originId: dto.originId,
      destinationId: dto.destinationId,
      vehicleId: dto.vehicleId,
      arrivalDate: new Date(dto.arrivalDate),
      departureDate: dto.departureDate ? new Date(dto.departureDate) : null,
      adults: dto.adults,
      children: dto.children,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      contactPref: dto.contactPref,
      arrivalAirline: dto.arrivalAirline,
      arrivalFlightNo: dto.arrivalFlightNo,
      arrivalTime: dto.arrivalTime,
      departureAirline: dto.departureAirline,
      departureFlightNo: dto.departureFlightNo,
      departureTime: dto.departureTime,
      comments: dto.comments,
      payMethod: dto.payMethod,
      extras: dto.extras,
    });

    return new BookingEntity(booking);
  }

  async findById(id: string): Promise<BookingEntity> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return new BookingEntity(booking);
  }

  async transitionStatus(
    id: string,
    next: BookingStatus,
  ): Promise<BookingEntity> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    assertValidBookingTransition(booking.status, next);
    const updated = await this.bookingsRepository.updateStatus(id, next);
    return new BookingEntity(updated);
  }

  /** Moves a fresh booking into "awaiting payment" once a payment attempt starts. Idempotent. */
  async markAwaitingPayment(id: string): Promise<BookingEntity> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    if (booking.status !== BookingStatus.nueva) {
      return new BookingEntity(booking);
    }

    assertValidBookingTransition(booking.status, BookingStatus.pendiente_pago);
    const updated = await this.bookingsRepository.updateStatus(
      id,
      BookingStatus.pendiente_pago,
    );
    return new BookingEntity(updated);
  }

  /** Called from the payment provider webhook once a charge succeeds. Idempotent. */
  async markPaymentSucceeded(id: string): Promise<BookingEntity> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    const nextStatus =
      booking.status === BookingStatus.pendiente_pago
        ? BookingStatus.confirmada
        : undefined;

    const updated = await this.bookingsRepository.updatePaymentOutcome(id, {
      status: nextStatus,
      paymentStatus: PaymentStatus.succeeded,
    });
    return new BookingEntity(updated);
  }

  /** Called from the payment provider webhook once a charge fails; the booking stays open for retry. */
  async markPaymentFailed(id: string): Promise<BookingEntity> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    const updated = await this.bookingsRepository.updatePaymentOutcome(id, {
      paymentStatus: PaymentStatus.failed,
    });
    return new BookingEntity(updated);
  }
}
