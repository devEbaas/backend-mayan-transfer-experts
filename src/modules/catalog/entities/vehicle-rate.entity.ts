import { ApiProperty } from '@nestjs/swagger';

export class VehicleRateEntity {
  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  capacityPassengers: number;

  @ApiProperty()
  capacityLuggage: number;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  rateId: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  priceNormal: number;

  @ApiProperty({ nullable: true })
  pricePromo: number | null;

  constructor(partial: VehicleRateEntity) {
    Object.assign(this, partial);
  }
}
