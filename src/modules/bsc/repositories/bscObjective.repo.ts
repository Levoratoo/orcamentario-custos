import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BscObjectiveRepo {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string) {
    return this.prisma.bscObjective.findUnique({ where: { slug } });
  }

  create(data: { perspectiveId: string; name: string; slug: string }) {
    return this.prisma.bscObjective.create({ data });
  }

  update(id: string, data: { perspectiveId: string; name: string }) {
    return this.prisma.bscObjective.update({ where: { id }, data });
  }
}

