import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateStripeIntentDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;
}
