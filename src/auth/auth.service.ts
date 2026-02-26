import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { addDurationToDate, parseDurationToSeconds } from '../common/utils/duration';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(identifier: string, password: string) {
    const user = await this.usersService.findByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    if (!user.active) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Usuario desativado' });
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    return this.issueTokens(user.id, user.role);
  }

  async refresh(userId: string, refreshTokenId: string) {
    const token = await this.prisma.refreshToken.findUnique({ where: { id: refreshTokenId } });
    if (!token || token.userId !== userId || token.revokedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Refresh token invalid' });
    }
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });
    const user = await this.usersService.findById(userId);
    if (!user.active) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'User inactive' });
    }
    return this.issueTokens(user.id, user.role);
  }

  async logout(userId: string, refreshTokenId: string) {
    const token = await this.prisma.refreshToken.findUnique({ where: { id: refreshTokenId } });
    if (!token || token.userId !== userId || token.revokedAt) {
      return;
    }
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  private async issueTokens(userId: string, role: string) {
    const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '365d';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '3650d';

    const refreshTokenId = await this.prisma.refreshToken.create({
      data: {
        userId,
        expiresAt: addDurationToDate(new Date(), refreshExpiresIn),
      },
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, role },
      { secret: process.env.JWT_SECRET, expiresIn: accessExpiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, role, jti: refreshTokenId.id },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: refreshExpiresIn },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: parseDurationToSeconds(accessExpiresIn),
      refreshTokenExpiresIn: parseDurationToSeconds(refreshExpiresIn),
    };
  }
}
