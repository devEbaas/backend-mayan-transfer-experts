import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role, User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const user: User = {
    id: '1',
    email: 'jane@example.com',
    password: 'hashed',
    name: 'Jane',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  it('creates a user with a hashed password', async () => {
    repository.create.mockResolvedValue(user);

    const result = await service.create({
      email: user.email,
      password: 'plain-password',
      name: user.name ?? undefined,
    });

    expect(result).toEqual(user);
    const createArgs = repository.create.mock.calls[0][0];
    expect(createArgs.password).not.toBe('plain-password');
  });

  it('throws ConflictException on duplicate email', async () => {
    repository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.create({ email: user.email, password: 'plain-password' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns paginated users', async () => {
    repository.findMany.mockResolvedValue([user]);
    repository.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20, skip: 0 });

    expect(result).toEqual({ items: [user], total: 1, page: 1, limit: 20 });
  });
});
