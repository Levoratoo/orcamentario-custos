import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscSnapshotsRepo {
  constructor(private readonly prisma: PrismaService) {}

  upsertTaskSnapshot(taskId: string, snapshotDate: Date, percentComplete: number | null) {
    return this.prisma.bscTaskSnapshot.upsert({
      where: { taskId_snapshotDate: { taskId, snapshotDate } },
      update: { percentComplete },
      create: { taskId, snapshotDate, percentComplete },
    });
  }
}

