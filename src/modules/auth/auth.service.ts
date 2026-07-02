import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../../config/config.type';
import { UsersService } from '../users/users.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const user = await this.usersService.create({ ...dto });
    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  login(user: AuthenticatedUser): Promise<AuthTokensDto> {
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.get('jwt.refreshSecret', { infer: true }),
        },
      );
      return this.issueTokens({
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async issueTokens(user: AuthenticatedUser): Promise<AuthTokensDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.secret', { infer: true }),
        expiresIn: this.configService.get('jwt.expiresIn', { infer: true }),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
        expiresIn: this.configService.get('jwt.refreshExpiresIn', {
          infer: true,
        }),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
