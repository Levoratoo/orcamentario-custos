import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscActualsRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsertMonthActual(
    indicatorId: string,
    year: number,
    month: number,
    actualValue: number | null,
    rawValue: string | null,
  ) {
    return this.prisma.bscIndicatorMonthActual.upsert({
      where: { indicatorId_year_month: { indicatorId, year, month } },
      update: { actualValue, rawValue },
      create: { indicatorId, year, month, actualValue, rawValue },
    });
  }
}

