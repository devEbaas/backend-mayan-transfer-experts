import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiOkResponse({ type: UserEntity })
  async create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    const user = await this.usersService.create(dto);
    return new UserEntity(user);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.usersService.findAll(query);
    return {
      ...result,
      items: result.items.map((user) => new UserEntity(user)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserEntity })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    const user = await this.usersService.findById(id);
    return new UserEntity(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiOkResponse({ type: UserEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    const user = await this.usersService.update(id, dto);
    return new UserEntity(user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
