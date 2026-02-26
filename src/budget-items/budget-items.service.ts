import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetItemDto } from './dto/create-budget-item.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import { UpdateBudgetItemValuesDto } from './dto/update-budget-item-values.dto';
import { ApplyValueDto } from './dto/apply-value.dto';
import { CopyFromMonthDto } from './dto/copy-from-month.dto';
import { DistributeTotalDto } from './dto/distribute-total.dto';
import { Role } from '@prisma/client';

@Injectable()
export class BudgetItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBudgetExists(budgetId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
    }
    return budget;
  }

  private async ensureCanEdit(user: any, accountCode: string, costCenterId?: string | null) {
    if (user.role === Role.ADMIN) return;
    const sponsor = await this.prisma.accountSponsor.findFirst({
      where: {
        accountCode,
        sponsorUserId: user.sub,
        ...(costCenterId
          ? { OR: [{ costCenterId }, { costCenterId: null }] }
          : { costCenterId: null }),
      },
    });
    if (!sponsor) {
      throw new ForbiddenException({ code: 'NOT_SPONSOR', message: 'Not allowed to edit this account' });
    }
  }

  private async getItem(itemId: string) {
    const item = await this.prisma.budgetItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Budget item not found' });
    }
    return item;
  }

  async create(dto: CreateBudgetItemDto, user: any) {
    await this.ensureBudgetExists(dto.budgetId);
    await this.ensureCanEdit(user, dto.accountCode, dto.costCenterId ?? null);

    const item = await this.prisma.budgetItem.create({
      data: {
        budgetId: dto.budgetId,
        accountCode: dto.accountCode,
        costCenterId: dto.costCenterId ?? null,
        itemName: dto.itemName,
        isReimbursement: dto.isReimbursement ?? false,
        comment: dto.comment ?? null,
        createdByUserId: user.sub,
      },
    });

    const values = Array.from({ length: 12 }).map((_, index) => ({
      budgetItemId: item.id,
      month: index + 1,
      value: 0,
    }));
    await this.prisma.budgetItemValue.createMany({ data: values });

    return this.getWithValues(item.id);
  }

  async update(itemId: string, dto: UpdateBudgetItemDto, user: any) {
    const item = await this.getItem(itemId);
    await this.ensureCanEdit(user, item.accountCode, item.costCenterId);

    await this.prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        itemName: dto.itemName,
        isActive: dto.isActive,
        isReimbursement: dto.isReimbursement,
        comment: dto.comment,
      },
    });

    return this.getWithValues(itemId);
  }

  async delete(itemId: string, user: any) {
    const item = await this.getItem(itemId);
    await this.ensureCanEdit(user, item.accountCode, item.costCenterId);
    await this.prisma.budgetItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async updateValues(itemId: string, dto: UpdateBudgetItemValuesDto, user: any) {
    const item = await this.getItem(itemId);
    await this.ensureCanEdit(user, item.accountCode, item.costCenterId);

    const updates = dto.values.map((entry) =>
      this.prisma.budgetItemValue.upsert({
        where: { budgetItemId_month: { budgetItemId: itemId, month: entry.month } },
        update: { value: entry.value },
        create: { budgetItemId: itemId, month: entry.month, value: entry.value },
      }),
    );

    await this.prisma.$transaction(updates);
    return this.getWithValues(itemId);
  }

  async applyValue(itemId: string, dto: ApplyValueDto, user: any) {
    const months = dto.months === 'ALL' || !dto.monthList ? Array.from({ length: 12 }, (_, i) => i + 1) : dto.monthList;
    return this.updateValues(itemId, { values: months.map((month) => ({ month, value: dto.value })) }, user);
  }

  async copyFromMonth(itemId: string, dto: CopyFromMonthDto, user: any) {
    const source = await this.prisma.budgetItemValue.findUnique({
      where: { budgetItemId_month: { budgetItemId: itemId, month: dto.fromMonth } },
    });
    if (!source) {
      throw new BadRequestException({ code: 'MONTH_NOT_FOUND', message: 'Mes de origem nao encontrado' });
    }
    const months = dto.months === 'ALL' || !dto.monthList ? Array.from({ length: 12 }, (_, i) => i + 1) : dto.monthList;
    return this.updateValues(itemId, { values: months.map((month) => ({ month, value: Number(source.value) })) }, user);
  }

  async distributeTotal(itemId: string, dto: DistributeTotalDto, user: any) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    if (dto.strategy === 'CUSTOM') {
      if (!dto.weights || dto.weights.length !== 12) {
        throw new BadRequestException({ code: 'INVALID_WEIGHTS', message: 'Weights precisam ter 12 valores' });
      }
      const totalWeight = dto.weights.reduce((sum, val) => sum + val, 0);
      if (totalWeight === 0) {
        throw new BadRequestException({ code: 'INVALID_WEIGHTS', message: 'Weights invalidos' });
      }
      const values = months.map((month, index) => ({
        month,
        value: (dto.annualTotal * dto.weights![index]) / totalWeight,
      }));
      return this.updateValues(itemId, { values }, user);
    }

    const equalValue = dto.annualTotal / 12;
    return this.updateValues(itemId, { values: months.map((month) => ({ month, value: equalValue })) }, user);
  }

  async getWithValues(itemId: string) {
    const item = await this.prisma.budgetItem.findUnique({
      where: { id: itemId },
      include: { values: true },
    });
    if (!item) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Budget item not found' });
    }
    const monthValues: Record<number, number> = {};
    item.values.forEach((value) => {
      monthValues[value.month] = Number(value.value);
    });
    const total = Object.values(monthValues).reduce((sum, value) => sum + value, 0);
    return {
      id: item.id,
      budgetId: item.budgetId,
      accountCode: item.accountCode,
      costCenterId: item.costCenterId,
      itemName: item.itemName,
      isActive: item.isActive,
      isReimbursement: item.isReimbursement,
      comment: item.comment,
      monthValues,
      total,
    };
  }
}
