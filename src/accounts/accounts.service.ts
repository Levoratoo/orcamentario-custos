import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(filters: { code?: string; category?: string }) {
    return this.prisma.account.findMany({
      where: {
        code: filters.code ? { contains: filters.code, mode: 'insensitive' } : undefined,
        category: filters.category ? { contains: filters.category, mode: 'insensitive' } : undefined,
      },
      orderBy: { code: 'asc' },
    });
  }

  async create(dto: CreateAccountDto, actorUserId: string) {
    const existing = await this.prisma.account.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException({ code: 'ACCOUNT_EXISTS', message: 'Account code already exists' });
    }
    const account = await this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      entityType: 'Account',
      entityId: account.id,
      action: 'CREATE',
      before: null,
      after: account,
      actorUserId,
    });
    return account;
  }

  async update(id: string, dto: UpdateAccountDto, actorUserId: string) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }
    const account = await this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        category: dto.category ?? existing.category,
        active: dto.active ?? existing.active,
      },
    });
    await this.audit.log({
      entityType: 'Account',
      entityId: account.id,
      action: 'UPDATE',
      before: existing,
      after: account,
      actorUserId,
    });
    return account;
  }
}
