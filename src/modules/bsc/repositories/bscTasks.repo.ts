import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscTasksRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsertByNaturalKey(
    projectId: string,
    wbs: string,
    name: string,
    data: {
      assignee?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      duration?: string | null;
      bucket?: string | null;
      percentComplete?: number | null;
      parentWbs?: string | null;
      level?: number | null;
    },
  ) {
    return this.prisma.bscProjectTask.upsert({
      where: { projectId_wbs_name: { projectId, wbs, name } },
      update: data,
      create: { projectId, wbs, name, ...data },
    });
  }
}

