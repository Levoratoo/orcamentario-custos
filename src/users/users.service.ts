import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private normalizeUsername(username?: string | null) {
    return username?.trim().toLowerCase();
  }

  async list(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, page, pageSize };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
  }

  async create(dto: CreateUserDto, actorUserId: string) {
    const username = this.normalizeUsername(dto.username);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, dto.email ? { email: dto.email } : undefined].filter(Boolean) as any,
      },
    });
    if (existing) {
      throw new BadRequestException({ code: 'USER_IN_USE', message: 'Username or email already in use' });
    }
    const passwordHash = await bcrypt.hash(dto.password || '123456', 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: username!,
        email: dto.email ?? null,
        role: dto.role ?? Role.COORDINATOR,
        passwordHash,
        mustChangePassword: dto.mustChangePassword ?? true,
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'CREATE',
      before: null,
      after: user,
      actorUserId,
    });
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    const existing = await this.findById(id);
    const nextUsername = dto.username ? this.normalizeUsername(dto.username) : existing.username;
    const nextEmail = dto.email ?? existing.email ?? null;
    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [
          nextUsername ? { username: nextUsername } : undefined,
          nextEmail ? { email: nextEmail } : undefined,
        ].filter(Boolean) as any,
        NOT: { id },
      },
    });
    if (duplicate) {
      throw new BadRequestException({ code: 'USER_IN_USE', message: 'Username or email already in use' });
    }
    const data: any = {
      name: dto.name ?? existing.name,
      username: nextUsername,
      email: nextEmail,
      role: dto.role ?? existing.role,
      mustChangePassword: dto.mustChangePassword ?? existing.mustChangePassword,
      active: dto.active ?? existing.active,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    const user = await this.prisma.user.update({ where: { id }, data });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'UPDATE',
      before: existing,
      after: user,
      actorUserId,
    });
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async deactivate(id: string, actorUserId: string) {
    const existing = await this.findById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { active: false } });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'UPDATE',
      before: existing,
      after: user,
      actorUserId,
    });
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  async resetPassword(id: string, actorUserId: string, newPassword?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    const passwordHash = await bcrypt.hash(newPassword || '123456', 10);
    const user = await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'UPDATE',
      before: existing,
      after: user,
      actorUserId,
    });
    return { success: true };
  }

  async updateProfile(userId: string, data: { name?: string; username?: string }) {
    const existing = await this.findById(userId);
    const nextUsername = data.username ? this.normalizeUsername(data.username) : existing.username;
    if (nextUsername !== existing.username) {
      const duplicate = await this.prisma.user.findFirst({
        where: { username: nextUsername, NOT: { id: userId } },
      });
      if (duplicate) {
        throw new BadRequestException({ code: 'USER_IN_USE', message: 'Username already in use' });
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name ?? existing.name,
        username: nextUsername,
      },
      select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
    });
    return updated;
  }

  async changeMyPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new BadRequestException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { success: true };
  }

  async syncUserAssignments(targetUserId: string, accountIds: string[], createdById: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    const uniqueIds = Array.from(new Set(accountIds));
    await this.prisma.$transaction(async (tx) => {
      await tx.userAccountAssignment.deleteMany({
        where: { userId: targetUserId, accountId: { notIn: uniqueIds } },
      });
      await Promise.all(
        uniqueIds.map((accountId) =>
          tx.userAccountAssignment.upsert({
            where: { userId_accountId: { userId: targetUserId, accountId } },
            update: {},
            create: { userId: targetUserId, accountId, createdById },
          }),
        ),
      );
    });
    return { success: true };
  }

  async listUserAssignments(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    const assignments = await this.prisma.userAccountAssignment.findMany({
      where: { userId: targetUserId },
      select: { accountId: true },
    });
    const accounts = await this.prisma.planningAccount.findMany({
      orderBy: [{ proacaoId: 'asc' }, { orderIndex: 'asc' }],
      include: { proacao: true },
    });
    return {
      user: { id: user.id, name: user.name, username: user.username },
      assignedAccountIds: assignments.map((item) => item.accountId),
      accounts: accounts.map((account) => ({
        id: account.id,
        code: account.code,
        label: account.label,
        name: account.name,
        proacao: { id: account.proacao.id, name: account.proacao.name },
      })),
    };
  }
}
