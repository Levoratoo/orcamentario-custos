import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { AuditService } from '../audit/audit.service';
import { ScenarioStatus } from '@prisma/client';

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(status?: string) {
    return this.prisma.scenario.findMany({
      where: status ? { status: status as ScenarioStatus } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new NotFoundException({ code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' });
    }
    return scenario;
  }

  async create(dto: CreateScenarioDto, actorUserId: string) {
    const scenario = await this.prisma.scenario.create({
      data: {
        name: dto.name,
        year: dto.year,
        createdById: actorUserId,
      },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'CREATE',
      before: null,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }

  async update(id: string, dto: UpdateScenarioDto, actorUserId: string) {
    const existing = await this.get(id);
    if (existing.status !== ScenarioStatus.DRAFT) {
      throw new BadRequestException({ code: 'SCENARIO_NOT_EDITABLE', message: 'Only DRAFT scenario can be edited' });
    }
    const scenario = await this.prisma.scenario.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        year: dto.year ?? existing.year,
      },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'UPDATE',
      before: existing,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }

  async submit(id: string, actorUserId: string) {
    const existing = await this.get(id);
    if (existing.status !== ScenarioStatus.DRAFT) {
      throw new BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be DRAFT to submit' });
    }
    const scenario = await this.prisma.scenario.update({
      where: { id },
      data: { status: ScenarioStatus.SUBMITTED, submittedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'STATUS_CHANGE',
      before: existing,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }

  async reopen(id: string, actorUserId: string) {
    const existing = await this.get(id);
    if (existing.status !== ScenarioStatus.SUBMITTED) {
      throw new BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be SUBMITTED to reopen' });
    }
    const scenario = await this.prisma.scenario.update({
      where: { id },
      data: { status: ScenarioStatus.DRAFT },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'STATUS_CHANGE',
      before: existing,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }

  async approve(id: string, actorUserId: string) {
    const existing = await this.get(id);
    if (existing.status !== ScenarioStatus.SUBMITTED) {
      throw new BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be SUBMITTED to approve' });
    }
    const scenario = await this.prisma.scenario.update({
      where: { id },
      data: { status: ScenarioStatus.APPROVED, approvedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'STATUS_CHANGE',
      before: existing,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }

  async lock(id: string, actorUserId: string) {
    const existing = await this.get(id);
    if (existing.status !== ScenarioStatus.APPROVED) {
      throw new BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be APPROVED to lock' });
    }
    const scenario = await this.prisma.scenario.update({
      where: { id },
      data: { status: ScenarioStatus.LOCKED, lockedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'Scenario',
      entityId: scenario.id,
      action: 'STATUS_CHANGE',
      before: existing,
      after: scenario,
      actorUserId,
    });
    return scenario;
  }
}
