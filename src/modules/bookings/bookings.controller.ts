import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingEntity } from './entities/booking.entity';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a booking at the end of the wizard' })
  @ApiCreatedResponse({ type: BookingEntity })
  create(@Body() dto: CreateBookingDto): Promise<BookingEntity> {
    return this.bookingsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking summary for PayStep/DoneStep' })
  @ApiOkResponse({ type: BookingEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BookingEntity> {
    return this.bookingsService.findById(id);
  }
}
