import { ApiProperty } from '@nestjs/swagger';
import { Place } from '@prisma/client';

export class PlaceEntity implements Place {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  labelEs: string;

  @ApiProperty()
  labelEn: string;

  @ApiProperty({ nullable: true })
  zone: string | null;

  @ApiProperty()
  isAirport: boolean;

  @ApiProperty()
  isPopular: boolean;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<PlaceEntity>) {
    Object.assign(this, partial);
  }
}
