import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { BulkUpsertDto } from './dto/bulk-upsert.dto';
import { validateMonthlyValues } from '../common/validators/monthly-values';
import { DriverType, Role, ScenarioStatus } from '@prisma/client';
import { MONTH_KEYS } from '../common/constants';

@Injectable()
export class BudgetLinesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private allowNegative() {
    return (process.env.ALLOW_NEGATIVE_VALUES || 'false') === 'true';
  }

  private async ensureEditableScenario(scenarioId: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      throw new NotFoundException({ code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' });
    }
    if (scenario.status !== ScenarioStatus.DRAFT) {
      throw new BadRequestException({ code: 'SCENARIO_NOT_EDITABLE', message: 'Scenario is not editable' });
    }
    return scenario;
  }

  private async ensureOwnership(user: any, costCenterId: string) {
    if (user.role === Role.COORDINATOR) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { id: costCenterId } });
      if (!costCenter || costCenter.ownerCoordinatorId !== user.sub) {
        throw new ForbiddenException({ code: 'NOT_OWNER', message: 'Not allowed to modify this cost center' });
      }
    }
  }

  async list(filters: { scenarioId?: string; costCenterId?: string; accountId?: string }, user: any, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: any = {
      scenarioId: filters.scenarioId ?? undefined,
      costCenterId: filters.costCenterId ?? undefined,
      accountId: filters.accountId ?? undefined,
    };
    if (user.role === Role.COORDINATOR) {
      const owned = await this.prisma.costCenter.findMany({ where: { ownerCoordinatorId: user.sub }, select: { id: true } });
      const ownedIds = owned.map((c) => c.id);
      if (filters.costCenterId) {
        where.costCenterId = ownedIds.includes(filters.costCenterId) ? filters.costCenterId : '__none__';
      } else {
        where.costCenterId = { in: ownedIds };
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.budgetLine.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.budgetLine.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateBudgetLineDto, user: any) {
    await this.ensureEditableScenario(dto.scenarioId);
    await this.ensureOwnership(user, dto.costCenterId);

    const costCenter = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
    if (!costCenter || !costCenter.active) {
      throw new BadRequestException({ code: 'COST_CENTER_INACTIVE', message: 'Cost center inactive or not found' });
    }
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account || !account.active) {
      throw new BadRequestException({ code: 'ACCOUNT_INACTIVE', message: 'Account inactive or not found' });
    }

    validateMonthlyValues(dto.monthlyValues, this.allowNegative());

    const budgetLine = await this.prisma.budgetLine.create({
      data: {
        scenarioId: dto.scenarioId,
        costCenterId: dto.costCenterId,
        accountId: dto.accountId,
        description: dto.description,
        driverType: dto.driverType,
        driverValue: dto.driverValue ?? undefined,
        monthlyValues: dto.monthlyValues,
        currency: dto.currency ?? 'BRL',
        assumptions: dto.assumptions ?? null,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });

    await this.audit.log({
      entityType: 'BudgetLine',
      entityId: budgetLine.id,
      action: 'CREATE',
      before: null,
      after: budgetLine,
      actorUserId: user.sub,
    });

    return budgetLine;
  }

  async update(id: string, dto: UpdateBudgetLineDto, user: any) {
    const existing = await this.prisma.budgetLine.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'BUDGET_LINE_NOT_FOUND', message: 'Budget line not found' });
    }

    await this.ensureEditableScenario(existing.scenarioId);
    await this.ensureOwnership(user, existing.costCenterId);

    if (dto.monthlyValues) {
      validateMonthlyValues(dto.monthlyValues, this.allowNegative());
    }

    const budgetLine = await this.prisma.budgetLine.update({
      where: { id },
      data: {
        description: dto.description ?? existing.description,
        driverType: dto.driverType ?? existing.driverType,
        driverValue: dto.driverValue ?? existing.driverValue,
        monthlyValues: dto.monthlyValues ?? existing.monthlyValues,
        currency: dto.currency ?? existing.currency,
        assumptions: dto.assumptions ?? existing.assumptions,
        updatedById: user.sub,
      },
    });

    await this.audit.log({
      entityType: 'BudgetLine',
      entityId: budgetLine.id,
      action: 'UPDATE',
      before: existing,
      after: budgetLine,
      actorUserId: user.sub,
    });

    return budgetLine;
  }

  async delete(id: string, user: any) {
    const existing = await this.prisma.budgetLine.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'BUDGET_LINE_NOT_FOUND', message: 'Budget line not found' });
    }

    await this.ensureEditableScenario(existing.scenarioId);
    await this.ensureOwnership(user, existing.costCenterId);

    const budgetLine = await this.prisma.budgetLine.delete({ where: { id } });
    await this.audit.log({
      entityType: 'BudgetLine',
      entityId: budgetLine.id,
      action: 'DELETE',
      before: existing,
      after: null,
      actorUserId: user.sub,
    });
    return budgetLine;
  }

  async bulkUpsert(dto: BulkUpsertDto, user: any) {
    await this.ensureEditableScenario(dto.scenarioId);

    const results = [] as any[];
    for (const item of dto.items) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { code: item.costCenterCode } });
      if (!costCenter) {
        results.push({
          status: 'error',
          error: 'COST_CENTER_NOT_FOUND',
          costCenterCode: item.costCenterCode,
        });
        continue;
      }
      if (!costCenter.active) {
        results.push({
          status: 'error',
          error: 'COST_CENTER_INACTIVE',
          costCenterCode: item.costCenterCode,
        });
        continue;
      }
      if (user.role === Role.COORDINATOR && costCenter.ownerCoordinatorId !== user.sub) {
        results.push({
          status: 'error',
          error: 'NOT_OWNER',
          costCenterCode: item.costCenterCode,
        });
        continue;
      }

      const account = await this.prisma.account.findUnique({ where: { code: item.accountCode } });
      if (!account) {
        results.push({
          status: 'error',
          error: 'ACCOUNT_NOT_FOUND',
          accountCode: item.accountCode,
        });
        continue;
      }
      if (!account.active) {
        results.push({
          status: 'error',
          error: 'ACCOUNT_INACTIVE',
          accountCode: item.accountCode,
        });
        continue;
      }

      try {
        validateMonthlyValues(item.monthlyValues, this.allowNegative());
      } catch (err) {
        results.push({ status: 'error', error: 'MONTHLY_VALUES_INVALID', details: (err as any).response });
        continue;
      }
      if (!Object.values(DriverType).includes(item.driverType as DriverType)) {
        results.push({ status: 'error', error: 'DRIVER_TYPE_INVALID', driverType: item.driverType });
        continue;
      }

      const existing = await this.prisma.budgetLine.findFirst({
        where: {
          scenarioId: dto.scenarioId,
          costCenterId: costCenter.id,
          accountId: account.id,
          description: item.description,
        },
      });

      if (existing) {
        const updated = await this.prisma.budgetLine.update({
          where: { id: existing.id },
          data: {
            driverType: item.driverType,
            driverValue: item.driverValue ?? existing.driverValue,
            monthlyValues: item.monthlyValues,
            assumptions: item.assumptions ?? existing.assumptions,
            updatedById: user.sub,
          },
        });
        await this.audit.log({
          entityType: 'BudgetLine',
          entityId: updated.id,
          action: 'UPDATE',
          before: existing,
          after: updated,
          actorUserId: user.sub,
        });
        results.push({ status: 'updated', id: updated.id });
      } else {
        const created = await this.prisma.budgetLine.create({
          data: {
            scenarioId: dto.scenarioId,
            costCenterId: costCenter.id,
            accountId: account.id,
            description: item.description,
            driverType: item.driverType,
            driverValue: item.driverValue ?? null,
            monthlyValues: item.monthlyValues,
            currency: 'BRL',
            assumptions: item.assumptions ?? null,
            createdById: user.sub,
            updatedById: user.sub,
          },
        });
        await this.audit.log({
          entityType: 'BudgetLine',
          entityId: created.id,
          action: 'CREATE',
          before: null,
          after: created,
          actorUserId: user.sub,
        });
        results.push({ status: 'inserted', id: created.id });
      }
    }

    return { scenarioId: dto.scenarioId, results };
  }

  async summary(scenarioId: string, groupBy: 'costCenter' | 'account' | 'category', user: any) {
    if (!scenarioId) {
      throw new BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(scenarioId)) {
      throw new BadRequestException({ code: 'SCENARIO_INVALID', message: 'scenarioId must be a UUID' });
    }

    const where: any = { scenarioId };
    if (user.role === Role.COORDINATOR) {
      where.costCenter = { ownerCoordinatorId: user.sub };
    }

    const lines = await this.prisma.budgetLine.findMany({
      where,
      include: { costCenter: true, account: true },
    });

    const itemsMap = new Map<
      string,
      {
        groupId: string;
        groupCode: string;
        groupName: string;
        monthlyTotals: Record<string, number>;
      }
    >();

    for (const line of lines) {
      let groupId = '';
      let groupCode = '';
      let groupName = '';
      if (groupBy === 'costCenter') {
        groupId = line.costCenter.id;
        groupCode = line.costCenter.code;
        groupName = line.costCenter.name;
      } else if (groupBy === 'account') {
        groupId = line.account.id;
        groupCode = line.account.code;
        groupName = line.account.name;
      } else {
        groupId = line.account.category;
        groupCode = line.account.category;
        groupName = line.account.category;
      }

      const key = groupId;
      if (!itemsMap.has(key)) {
        const monthlyTotals: Record<string, number> = {};
        for (const monthKey of MONTH_KEYS) {
          monthlyTotals[monthKey] = 0;
        }
        itemsMap.set(key, { groupId, groupCode, groupName, monthlyTotals });
      }

      const entry = itemsMap.get(key)!;
      const values = (line.monthlyValues ?? {}) as Record<string, unknown>;
      for (const monthKey of MONTH_KEYS) {
        const raw = values[monthKey] ?? 0;
        const value = typeof raw === 'number' ? raw : Number(raw);
        entry.monthlyTotals[monthKey] += Number.isFinite(value) ? value : 0;
      }
    }

    const items = Array.from(itemsMap.values())
      .map((entry) => {
        const monthly: Record<string, string> = {};
        let total = 0;
        for (const monthKey of MONTH_KEYS) {
          const value = entry.monthlyTotals[monthKey] ?? 0;
          total += value;
          monthly[monthKey] = value.toFixed(2);
        }
        return {
          groupId: entry.groupId,
          groupCode: entry.groupCode,
          groupName: entry.groupName,
          monthlyValues: monthly,
          total: total.toFixed(2),
        };
      })
      .sort((a, b) => a.groupCode.localeCompare(b.groupCode, 'pt-BR', { sensitivity: 'base' }));

    return { items };
  }
}
