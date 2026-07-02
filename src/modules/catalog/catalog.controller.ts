import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { GetVehiclesQueryDto } from './dto/get-vehicles-query.dto';
import { PlaceEntity } from './entities/place.entity';
import { VehicleRateEntity } from './entities/vehicle-rate.entity';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('routes')
  @ApiOperation({
    summary: 'List active places for origin/destination pickers',
  })
  @ApiOkResponse({ type: PlaceEntity, isArray: true })
  getRoutes(): Promise<PlaceEntity[]> {
    return this.catalogService.getRoutes();
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'List vehicles and prices for a given route' })
  @ApiOkResponse({ type: VehicleRateEntity, isArray: true })
  getVehicles(
    @Query() query: GetVehiclesQueryDto,
  ): Promise<VehicleRateEntity[]> {
    return this.catalogService.getVehiclesForRoute(query);
  }
}
