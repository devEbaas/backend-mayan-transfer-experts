import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
  exports: [BookingsService],
})
export class BookingsModule {}
