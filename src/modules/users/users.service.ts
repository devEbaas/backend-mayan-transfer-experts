import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      return await this.usersRepository.create({
        ...dto,
        password: hashedPassword,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ items: User[]; total: number; page: number; limit: number }> {
    const [items, total] = await Promise.all([
      this.usersRepository.findMany({ skip: query.skip, take: query.limit }),
      this.usersRepository.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findById(id);
    return this.usersRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.delete(id);
  }
}
