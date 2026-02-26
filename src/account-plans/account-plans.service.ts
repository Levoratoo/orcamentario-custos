import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountPlanDto } from './dto/update-account-plan.dto';
import { parseAccountPlanXlsx, importAccountPlanRows, ImportSummary } from './account-plans.importer';
import { AccountPlanType, Prisma } from '@prisma/client';
import * as fs from 'fs';

interface ListFilters {
  search?: string;
  tipo?: AccountPlanType;
  parentId?: string;
  nivel?: number;
  tree?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AccountPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromXlsx(file: Express.Multer.File): Promise<ImportSummary> {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
    }
    const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      throw new BadRequestException({ code: 'FILE_BUFFER_MISSING', message: 'Arquivo nao pode ser lido' });
    }
    const { rows, errors } = parseAccountPlanXlsx(buffer);
    const summary = await importAccountPlanRows(this.prisma, rows, errors);

    await this.prisma.importJob.create({
      data: {
        fileName: file.originalname,
        totalRows: summary.total,
        inserted: summary.inserted,
        updated: summary.updated,
        errors: summary.errors as unknown as Prisma.JsonValue,
      },
    });

    return summary;
  }

  async list(filters: ListFilters) {
    const where: any = {
      isAtiva: true,
      type: filters.tipo ?? undefined,
      parentId: filters.parentId ?? undefined,
      level: filters.nivel ?? undefined,
    };

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { classification: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.tree) {
      const items = await this.prisma.accountPlan.findMany({
        where,
        orderBy: { classification: 'asc' },
      });
      const tree = this.buildTree(items);
      return { items: tree, total: items.length };
    }

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountPlan.findMany({ where, skip, take: pageSize, orderBy: { classification: 'asc' } }),
      this.prisma.accountPlan.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async update(id: string, dto: UpdateAccountPlanDto) {
    const existing = await this.prisma.accountPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'ACCOUNT_PLAN_NOT_FOUND', message: 'Conta nao encontrada' });
    }
    return this.prisma.accountPlan.update({
      where: { id },
      data: {
        description: dto.description ?? existing.description,
        isAtiva: dto.isAtiva ?? existing.isAtiva,
      },
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.accountPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'ACCOUNT_PLAN_NOT_FOUND', message: 'Conta nao encontrada' });
    }
    return this.prisma.accountPlan.update({
      where: { id },
      data: { isAtiva: false },
    });
  }

  private buildTree(items: any[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach((item) => {
      const node = map.get(item.id);
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
