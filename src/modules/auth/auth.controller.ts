import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and issue tokens' })
  @ApiOkResponse({ type: AuthTokensDto })
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthTokensDto })
  login(@Req() req: Request, @Body() _dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.login(req.user as AuthenticatedUser);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }
}
