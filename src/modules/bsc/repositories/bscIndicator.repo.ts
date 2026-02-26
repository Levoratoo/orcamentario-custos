import { Injectable } from '@nestjs/common';
import { BscIndicatorDirection } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscIndicatorRepo {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.bscIndicator.findUnique({ where: { code } });
  }

  create(data: {
    objectiveId: string;
    code: string;
    name: string;
    responsible?: string | null;
    dataOwner?: string | null;
    keywords?: string | null;
    level?: number | null;
    process?: string | null;
    direction?: BscIndicatorDirection;
    needsReview?: boolean;
  }) {
    return this.prisma.bscIndicator.create({ data });
  }

  update(
    id: string,
    data: {
      objectiveId?: string;
      name?: string;
      responsible?: string | null;
      dataOwner?: string | null;
      keywords?: string | null;
      level?: number | null;
      process?: string | null;
      direction?: BscIndicatorDirection;
      needsReview?: boolean;
    },
  ) {
    return this.prisma.bscIndicator.update({ where: { id }, data });
  }
}
