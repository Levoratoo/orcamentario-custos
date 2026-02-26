import { Injectable } from '@nestjs/common';
import { BscPerspectiveName } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscPerspectiveRepo {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(name: BscPerspectiveName, orderIndex: number) {
    return this.prisma.bscPerspective.upsert({
      where: { name },
      update: { orderIndex },
      create: { name, orderIndex },
    });
  }
}

