import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CostCentersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(filters: { code?: string; ownerId?: string }) {
    return this.prisma.costCenter.findMany({
      where: {
        code: filters.code ? { contains: filters.code, mode: 'insensitive' } : undefined,
        ownerCoordinatorId: filters.ownerId ?? undefined,
      },
      orderBy: { code: 'asc' },
    });
  }

  async create(dto: CreateCostCenterDto, actorUserId: string) {
    const existing = await this.prisma.costCenter.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException({ code: 'COST_CENTER_EXISTS', message: 'Cost center code already exists' });
    }
    const costCenter = await this.prisma.costCenter.create({
      data: {
        code: dto.code,
        name: dto.name,
        active: dto.active ?? true,
        ownerCoordinatorId: dto.ownerCoordinatorId ?? null,
      },
    });
    await this.audit.log({
      entityType: 'CostCenter',
      entityId: costCenter.id,
      action: 'CREATE',
      before: null,
      after: costCenter,
      actorUserId,
    });
    return costCenter;
  }

  async update(id: string, dto: UpdateCostCenterDto, actorUserId: string) {
    const existing = await this.prisma.costCenter.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'COST_CENTER_NOT_FOUND', message: 'Cost center not found' });
    }
    const costCenter = await this.prisma.costCenter.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        active: dto.active ?? existing.active,
      },
    });
    await this.audit.log({
      entityType: 'CostCenter',
      entityId: costCenter.id,
      action: 'UPDATE',
      before: existing,
      after: costCenter,
      actorUserId,
    });
    return costCenter;
  }

  async setOwner(id: string, ownerCoordinatorId: string | null, actorUserId: string) {
    const existing = await this.prisma.costCenter.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'COST_CENTER_NOT_FOUND', message: 'Cost center not found' });
    }
    const costCenter = await this.prisma.costCenter.update({
      where: { id },
      data: { ownerCoordinatorId },
    });
    await this.audit.log({
      entityType: 'CostCenter',
      entityId: costCenter.id,
      action: 'UPDATE',
      before: existing,
      after: costCenter,
      actorUserId,
    });
    return costCenter;
  }
}
