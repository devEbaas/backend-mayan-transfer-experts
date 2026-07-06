import { ApiProperty } from '@nestjs/swagger';
import {
  BookingStatus,
  ContactPref,
  PayMethod,
  PaymentStatus,
  TripType,
} from '@prisma/client';
import type { BookingWithExtras } from '../bookings.repository';

export class BookingExtraLineEntity {
  @ApiProperty()
  extraId: string;

  @ApiProperty()
  labelEs: string;

  @ApiProperty()
  labelEn: string;

  @ApiProperty()
  qty: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  currency: string;

  constructor(partial: BookingExtraLineEntity) {
    Object.assign(this, partial);
  }
}

export class BookingEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  folio: string;

  @ApiProperty({ enum: TripType })
  tripType: TripType;

  @ApiProperty()
  originId: string;

  @ApiProperty()
  destinationId: string;

  @ApiProperty()
  arrivalDate: Date;

  @ApiProperty({ nullable: true })
  departureDate: Date | null;

  @ApiProperty()
  adults: number;

  @ApiProperty()
  children: number;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  vehicleName: string;

  @ApiProperty()
  priceTotal: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: ContactPref })
  contactPref: ContactPref;

  @ApiProperty({ nullable: true })
  arrivalAirline: string | null;

  @ApiProperty({ nullable: true })
  arrivalFlightNo: string | null;

  @ApiProperty({ nullable: true })
  arrivalTime: string | null;

  @ApiProperty({ nullable: true })
  departureAirline: string | null;

  @ApiProperty({ nullable: true })
  departureFlightNo: string | null;

  @ApiProperty({ nullable: true })
  departureTime: string | null;

  @ApiProperty({ nullable: true })
  comments: string | null;

  @ApiProperty({ enum: PayMethod })
  payMethod: PayMethod;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: BookingExtraLineEntity, isArray: true })
  extras: BookingExtraLineEntity[];

  constructor(booking: BookingWithExtras) {
    this.id = booking.id;
    this.folio = booking.folio;
    this.tripType = booking.tripType;
    this.originId = booking.originId;
    this.destinationId = booking.destinationId;
    this.arrivalDate = booking.arrivalDate;
    this.departureDate = booking.departureDate;
    this.adults = booking.adults;
    this.children = booking.children;
    this.vehicleId = booking.vehicleId;
    this.vehicleName = booking.vehicle.name;
    this.priceTotal = booking.priceTotal.toNumber();
    this.currency = booking.currency;
    this.firstName = booking.firstName;
    this.lastName = booking.lastName;
    this.email = booking.email;
    this.phone = booking.phone;
    this.contactPref = booking.contactPref;
    this.arrivalAirline = booking.arrivalAirline;
    this.arrivalFlightNo = booking.arrivalFlightNo;
    this.arrivalTime = booking.arrivalTime;
    this.departureAirline = booking.departureAirline;
    this.departureFlightNo = booking.departureFlightNo;
    this.departureTime = booking.departureTime;
    this.comments = booking.comments;
    this.payMethod = booking.payMethod;
    this.paymentStatus = booking.paymentStatus;
    this.status = booking.status;
    this.extras = booking.extras.map(
      (line) =>
        new BookingExtraLineEntity({
          extraId: line.extraId,
          labelEs: line.extra.labelEs,
          labelEn: line.extra.labelEn,
          qty: line.qty,
          unitPrice: line.unitPrice.toNumber(),
          currency: line.currency,
        }),
    );
    this.createdAt = booking.createdAt;
    this.updatedAt = booking.updatedAt;
  }
}
