import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactPref, PayMethod, TripType } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ enum: TripType })
  @IsEnum(TripType)
  tripType: TripType;

  @ApiProperty()
  @IsUUID()
  originId: string;

  @ApiProperty()
  @IsUUID()
  destinationId: string;

  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  arrivalDate: string;

  @ApiPropertyOptional({
    description: 'ISO date (YYYY-MM-DD); required when tripType is "round"',
  })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  adults: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  children: number = 0;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ enum: ContactPref })
  @IsEnum(ContactPref)
  contactPref: ContactPref;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  arrivalAirline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  arrivalFlightNo?: string;

  @ApiPropertyOptional({ description: 'Free-form time, e.g. "14:30"' })
  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departureAirline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departureFlightNo?: string;

  @ApiPropertyOptional({ description: 'Free-form time, e.g. "14:30"' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ enum: PayMethod })
  @IsEnum(PayMethod)
  payMethod: PayMethod;
}
