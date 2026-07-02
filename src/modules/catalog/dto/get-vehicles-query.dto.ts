import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetVehiclesQueryDto {
  @ApiProperty()
  @IsUUID()
  originId: string;

  @ApiProperty()
  @IsUUID()
  destinationId: string;
}
