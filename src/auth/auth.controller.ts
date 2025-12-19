import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { username, password } = body || {};
    if (!username || !password)
      throw new BadRequestException('username/password required');

    const result = await this.auth.login(username, password);
    res.cookie('accessToken', result.token, this.auth.cookieOptions());

    return { message: 'Login successfully.', user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    return { message: 'Logout successfully.' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: any) {
    return { user: req.user };
  }
}
