import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: AuditAction | string;
  before: any | null;
  after: any | null;
  actorUserId: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action as AuditAction,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }
}
