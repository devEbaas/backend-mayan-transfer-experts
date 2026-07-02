import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findMany(params: { skip?: number; take?: number }): Promise<User[]> {
    return this.prisma.user.findMany({
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
