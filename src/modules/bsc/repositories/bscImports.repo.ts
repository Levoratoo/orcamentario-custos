import { Injectable } from '@nestjs/common';
import { BscImportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscImportsRepo {
  constructor(private readonly prisma: PrismaService) {}

  findSuccessfulByHash(fileHash: string) {
    return this.prisma.bscImport.findFirst({
      where: { fileHash, status: BscImportStatus.SUCCESS },
      orderBy: { startedAt: 'desc' },
    });
  }

  createStart(data: { fileName: string; fileHash: string; importedById?: string | null }) {
    return this.prisma.bscImport.create({ data });
  }

  finishSuccess(id: string, warnings: Prisma.JsonValue, counters: Prisma.JsonValue) {
    return this.prisma.bscImport.update({
      where: { id },
      data: {
        status: BscImportStatus.SUCCESS,
        finishedAt: new Date(),
        warnings,
        counters,
      },
    });
  }

  finishPartial(id: string, warnings: Prisma.JsonValue, counters: Prisma.JsonValue) {
    return this.prisma.bscImport.update({
      where: { id },
      data: {
        status: BscImportStatus.PARTIAL,
        finishedAt: new Date(),
        warnings,
        counters,
      },
    });
  }

  finishFailed(id: string, warnings: Prisma.JsonValue, counters: Prisma.JsonValue, errorMessage: string) {
    return this.prisma.bscImport.update({
      where: { id },
      data: {
        status: BscImportStatus.FAILED,
        finishedAt: new Date(),
        warnings,
        counters,
        errorMessage,
      },
    });
  }

  list() {
    return this.prisma.bscImport.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  findById(id: string) {
    return this.prisma.bscImport.findUnique({ where: { id } });
  }
}

