import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const user: User = {
    id: '1',
    email: 'jane@example.com',
    password: '',
    name: 'Jane',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    user.password = await bcrypt.hash('correct-password', 10);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), create: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('config-value') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('validates a user with correct credentials', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.validateUser(user.email, 'correct-password');

    expect(result).toEqual({ id: user.id, email: user.email, role: user.role });
  });

  it('returns null for an incorrect password', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.validateUser(user.email, 'wrong-password');

    expect(result).toBeNull();
  });

  it('returns null when the user does not exist', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.validateUser(
      'missing@example.com',
      'irrelevant',
    );

    expect(result).toBeNull();
  });

  it('issues an access and refresh token on login', async () => {
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.login({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('throws UnauthorizedException for an invalid refresh token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
