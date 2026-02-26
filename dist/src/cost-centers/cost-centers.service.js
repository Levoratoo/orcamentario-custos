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
exports.CostCentersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let CostCentersService = class CostCentersService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters) {
        return this.prisma.costCenter.findMany({
            where: {
                code: filters.code ? { contains: filters.code, mode: 'insensitive' } : undefined,
                ownerCoordinatorId: filters.ownerId ?? undefined,
            },
            orderBy: { code: 'asc' },
        });
    }
    async create(dto, actorUserId) {
        const existing = await this.prisma.costCenter.findUnique({ where: { code: dto.code } });
        if (existing) {
            throw new common_1.BadRequestException({ code: 'COST_CENTER_EXISTS', message: 'Cost center code already exists' });
        }
        const costCenter = await this.prisma.costCenter.create({
            data: {
                code: dto.code,
                name: dto.name,
                active: dto.active ?? true,
                ownerCoordinatorId: dto.ownerCoordinatorId ?? null,
            },
        });
        await this.audit.log({
            entityType: 'CostCenter',
            entityId: costCenter.id,
            action: 'CREATE',
            before: null,
            after: costCenter,
            actorUserId,
        });
        return costCenter;
    }
    async update(id, dto, actorUserId) {
        const existing = await this.prisma.costCenter.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'COST_CENTER_NOT_FOUND', message: 'Cost center not found' });
        }
        const costCenter = await this.prisma.costCenter.update({
            where: { id },
            data: {
                name: dto.name ?? existing.name,
                active: dto.active ?? existing.active,
            },
        });
        await this.audit.log({
            entityType: 'CostCenter',
            entityId: costCenter.id,
            action: 'UPDATE',
            before: existing,
            after: costCenter,
            actorUserId,
        });
        return costCenter;
    }
    async setOwner(id, ownerCoordinatorId, actorUserId) {
        const existing = await this.prisma.costCenter.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'COST_CENTER_NOT_FOUND', message: 'Cost center not found' });
        }
        const costCenter = await this.prisma.costCenter.update({
            where: { id },
            data: { ownerCoordinatorId },
        });
        await this.audit.log({
            entityType: 'CostCenter',
            entityId: costCenter.id,
            action: 'UPDATE',
            before: existing,
            after: costCenter,
            actorUserId,
        });
        return costCenter;
    }
};
exports.CostCentersService = CostCentersService;
exports.CostCentersService = CostCentersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], CostCentersService);
//# sourceMappingURL=cost-centers.service.js.map