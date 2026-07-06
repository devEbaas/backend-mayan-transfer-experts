import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class BookingExtraDto {
  @ApiProperty()
  @IsUUID()
  extraId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  qty: number;
}
