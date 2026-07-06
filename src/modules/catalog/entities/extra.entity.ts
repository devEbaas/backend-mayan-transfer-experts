import { ApiProperty } from '@nestjs/swagger';

export class ExtraEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  labelEs: string;

  @ApiProperty()
  labelEn: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  maxQty: number;

  constructor(partial: ExtraEntity) {
    Object.assign(this, partial);
  }
}
