import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscProjectsRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsertByNameAndSnapshot(
    name: string,
    snapshotDate: Date,
    data?: {
      owner?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      duration?: string | null;
      percentComplete?: number | null;
    },
  ) {
    return this.prisma.bscProject.upsert({
      where: { name_snapshotDate: { name, snapshotDate } },
      update: data ?? {},
      create: { name, snapshotDate, ...(data ?? {}) },
    });
  }
}

