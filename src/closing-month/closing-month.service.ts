import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetKind } from '@prisma/client';

@Injectable()
export class ClosingMonthService {
  constructor(private readonly prisma: PrismaService) {}

  async get(year: number, kind: BudgetKind) {
    const record = await this.prisma.closingMonth.findUnique({
      where: { year_kind: { year, kind } },
    });
    return { year, closingMonth: record?.closingMonth ?? 0 };
  }

  async set(year: number, kind: BudgetKind, closingMonth: number) {
    const record = await this.prisma.closingMonth.upsert({
      where: { year_kind: { year, kind } },
      update: { closingMonth },
      create: { year, kind, closingMonth },
    });
    return { year: record.year, closingMonth: record.closingMonth };
  }
}
