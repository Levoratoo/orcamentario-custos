import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscTargetsRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsertYearTarget(indicatorId: string, year: number, targetValue: number | null, rawValue: string | null) {
    return this.prisma.bscIndicatorYearTarget.upsert({
      where: { indicatorId_year: { indicatorId, year } },
      update: { targetValue, rawValue },
      create: { indicatorId, year, targetValue, rawValue },
    });
  }

  upsertMonthTarget(
    indicatorId: string,
    year: number,
    month: number,
    targetValue: number | null,
    rawValue: string | null,
  ) {
    return this.prisma.bscIndicatorMonthTarget.upsert({
      where: { indicatorId_year_month: { indicatorId, year, month } },
      update: { targetValue, rawValue },
      create: { indicatorId, year, month, targetValue, rawValue },
    });
  }
}

