"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenariosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const client_1 = require("@prisma/client");
let ScenariosService = class ScenariosService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(status) {
        return this.prisma.scenario.findMany({
            where: status ? { status: status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    async get(id) {
        const scenario = await this.prisma.scenario.findUnique({ where: { id } });
        if (!scenario) {
            throw new common_1.NotFoundException({ code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' });
        }
        return scenario;
    }
    async create(dto, actorUserId) {
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
    async update(id, dto, actorUserId) {
        const existing = await this.get(id);
        if (existing.status !== client_1.ScenarioStatus.DRAFT) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_NOT_EDITABLE', message: 'Only DRAFT scenario can be edited' });
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
    async submit(id, actorUserId) {
        const existing = await this.get(id);
        if (existing.status !== client_1.ScenarioStatus.DRAFT) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be DRAFT to submit' });
        }
        const scenario = await this.prisma.scenario.update({
            where: { id },
            data: { status: client_1.ScenarioStatus.SUBMITTED, submittedAt: new Date() },
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
    async reopen(id, actorUserId) {
        const existing = await this.get(id);
        if (existing.status !== client_1.ScenarioStatus.SUBMITTED) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be SUBMITTED to reopen' });
        }
        const scenario = await this.prisma.scenario.update({
            where: { id },
            data: { status: client_1.ScenarioStatus.DRAFT },
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
    async approve(id, actorUserId) {
        const existing = await this.get(id);
        if (existing.status !== client_1.ScenarioStatus.SUBMITTED) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be SUBMITTED to approve' });
        }
        const scenario = await this.prisma.scenario.update({
            where: { id },
            data: { status: client_1.ScenarioStatus.APPROVED, approvedAt: new Date() },
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
    async lock(id, actorUserId) {
        const existing = await this.get(id);
        if (existing.status !== client_1.ScenarioStatus.APPROVED) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_INVALID_STATUS', message: 'Scenario must be APPROVED to lock' });
        }
        const scenario = await this.prisma.scenario.update({
            where: { id },
            data: { status: client_1.ScenarioStatus.LOCKED, lockedAt: new Date() },
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
};
exports.ScenariosService = ScenariosService;
exports.ScenariosService = ScenariosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], ScenariosService);
//# sourceMappingURL=scenarios.service.js.map