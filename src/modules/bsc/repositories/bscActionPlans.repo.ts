import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscActionPlansRepo {
  constructor(private readonly prisma: PrismaService) {}

  deleteByIndicatorAndSheet(indicatorId: string, sourceSheet: string) {
    return this.prisma.bscIndicatorActionPlan.deleteMany({ where: { indicatorId, sourceSheet } });
  }

  create(data: {
    indicatorId: string;
    period?: string | null;
    fact?: string | null;
    priority?: string | null;
    cause?: string | null;
    action?: string | null;
    owner?: string | null;
    dueDate?: Date | null;
    effectiveness?: string | null;
    relatedIndicators?: string | null;
    sourceSheet: string;
    rowIndex: number;
  }) {
    return this.prisma.bscIndicatorActionPlan.create({ data });
  }
}

