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
exports.BudgetLinesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const monthly_values_1 = require("../common/validators/monthly-values");
const client_1 = require("@prisma/client");
const constants_1 = require("../common/constants");
let BudgetLinesService = class BudgetLinesService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    allowNegative() {
        return (process.env.ALLOW_NEGATIVE_VALUES || 'false') === 'true';
    }
    async ensureEditableScenario(scenarioId) {
        const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
        if (!scenario) {
            throw new common_1.NotFoundException({ code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' });
        }
        if (scenario.status !== client_1.ScenarioStatus.DRAFT) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_NOT_EDITABLE', message: 'Scenario is not editable' });
        }
        return scenario;
    }
    async ensureOwnership(user, costCenterId) {
        if (user.role === client_1.Role.COORDINATOR) {
            const costCenter = await this.prisma.costCenter.findUnique({ where: { id: costCenterId } });
            if (!costCenter || costCenter.ownerCoordinatorId !== user.sub) {
                throw new common_1.ForbiddenException({ code: 'NOT_OWNER', message: 'Not allowed to modify this cost center' });
            }
        }
    }
    async list(filters, user, page, pageSize) {
        const skip = (page - 1) * pageSize;
        const where = {
            scenarioId: filters.scenarioId ?? undefined,
            costCenterId: filters.costCenterId ?? undefined,
            accountId: filters.accountId ?? undefined,
        };
        if (user.role === client_1.Role.COORDINATOR) {
            const owned = await this.prisma.costCenter.findMany({ where: { ownerCoordinatorId: user.sub }, select: { id: true } });
            const ownedIds = owned.map((c) => c.id);
            if (filters.costCenterId) {
                where.costCenterId = ownedIds.includes(filters.costCenterId) ? filters.costCenterId : '__none__';
            }
            else {
                where.costCenterId = { in: ownedIds };
            }
        }
        const [items, total] = await this.prisma.$transaction([
            this.prisma.budgetLine.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.budgetLine.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async create(dto, user) {
        await this.ensureEditableScenario(dto.scenarioId);
        await this.ensureOwnership(user, dto.costCenterId);
        const costCenter = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
        if (!costCenter || !costCenter.active) {
            throw new common_1.BadRequestException({ code: 'COST_CENTER_INACTIVE', message: 'Cost center inactive or not found' });
        }
        const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
        if (!account || !account.active) {
            throw new common_1.BadRequestException({ code: 'ACCOUNT_INACTIVE', message: 'Account inactive or not found' });
        }
        (0, monthly_values_1.validateMonthlyValues)(dto.monthlyValues, this.allowNegative());
        const budgetLine = await this.prisma.budgetLine.create({
            data: {
                scenarioId: dto.scenarioId,
                costCenterId: dto.costCenterId,
                accountId: dto.accountId,
                description: dto.description,
                driverType: dto.driverType,
                driverValue: dto.driverValue ?? undefined,
                monthlyValues: dto.monthlyValues,
                currency: dto.currency ?? 'BRL',
                assumptions: dto.assumptions ?? null,
                createdById: user.sub,
                updatedById: user.sub,
            },
        });
        await this.audit.log({
            entityType: 'BudgetLine',
            entityId: budgetLine.id,
            action: 'CREATE',
            before: null,
            after: budgetLine,
            actorUserId: user.sub,
        });
        return budgetLine;
    }
    async update(id, dto, user) {
        const existing = await this.prisma.budgetLine.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'BUDGET_LINE_NOT_FOUND', message: 'Budget line not found' });
        }
        await this.ensureEditableScenario(existing.scenarioId);
        await this.ensureOwnership(user, existing.costCenterId);
        if (dto.monthlyValues) {
            (0, monthly_values_1.validateMonthlyValues)(dto.monthlyValues, this.allowNegative());
        }
        const budgetLine = await this.prisma.budgetLine.update({
            where: { id },
            data: {
                description: dto.description ?? existing.description,
                driverType: dto.driverType ?? existing.driverType,
                driverValue: dto.driverValue ?? existing.driverValue,
                monthlyValues: dto.monthlyValues ?? existing.monthlyValues,
                currency: dto.currency ?? existing.currency,
                assumptions: dto.assumptions ?? existing.assumptions,
                updatedById: user.sub,
            },
        });
        await this.audit.log({
            entityType: 'BudgetLine',
            entityId: budgetLine.id,
            action: 'UPDATE',
            before: existing,
            after: budgetLine,
            actorUserId: user.sub,
        });
        return budgetLine;
    }
    async delete(id, user) {
        const existing = await this.prisma.budgetLine.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'BUDGET_LINE_NOT_FOUND', message: 'Budget line not found' });
        }
        await this.ensureEditableScenario(existing.scenarioId);
        await this.ensureOwnership(user, existing.costCenterId);
        const budgetLine = await this.prisma.budgetLine.delete({ where: { id } });
        await this.audit.log({
            entityType: 'BudgetLine',
            entityId: budgetLine.id,
            action: 'DELETE',
            before: existing,
            after: null,
            actorUserId: user.sub,
        });
        return budgetLine;
    }
    async bulkUpsert(dto, user) {
        await this.ensureEditableScenario(dto.scenarioId);
        const results = [];
        for (const item of dto.items) {
            const costCenter = await this.prisma.costCenter.findUnique({ where: { code: item.costCenterCode } });
            if (!costCenter) {
                results.push({
                    status: 'error',
                    error: 'COST_CENTER_NOT_FOUND',
                    costCenterCode: item.costCenterCode,
                });
                continue;
            }
            if (!costCenter.active) {
                results.push({
                    status: 'error',
                    error: 'COST_CENTER_INACTIVE',
                    costCenterCode: item.costCenterCode,
                });
                continue;
            }
            if (user.role === client_1.Role.COORDINATOR && costCenter.ownerCoordinatorId !== user.sub) {
                results.push({
                    status: 'error',
                    error: 'NOT_OWNER',
                    costCenterCode: item.costCenterCode,
                });
                continue;
            }
            const account = await this.prisma.account.findUnique({ where: { code: item.accountCode } });
            if (!account) {
                results.push({
                    status: 'error',
                    error: 'ACCOUNT_NOT_FOUND',
                    accountCode: item.accountCode,
                });
                continue;
            }
            if (!account.active) {
                results.push({
                    status: 'error',
                    error: 'ACCOUNT_INACTIVE',
                    accountCode: item.accountCode,
                });
                continue;
            }
            try {
                (0, monthly_values_1.validateMonthlyValues)(item.monthlyValues, this.allowNegative());
            }
            catch (err) {
                results.push({ status: 'error', error: 'MONTHLY_VALUES_INVALID', details: err.response });
                continue;
            }
            if (!Object.values(client_1.DriverType).includes(item.driverType)) {
                results.push({ status: 'error', error: 'DRIVER_TYPE_INVALID', driverType: item.driverType });
                continue;
            }
            const existing = await this.prisma.budgetLine.findFirst({
                where: {
                    scenarioId: dto.scenarioId,
                    costCenterId: costCenter.id,
                    accountId: account.id,
                    description: item.description,
                },
            });
            if (existing) {
                const updated = await this.prisma.budgetLine.update({
                    where: { id: existing.id },
                    data: {
                        driverType: item.driverType,
                        driverValue: item.driverValue ?? existing.driverValue,
                        monthlyValues: item.monthlyValues,
                        assumptions: item.assumptions ?? existing.assumptions,
                        updatedById: user.sub,
                    },
                });
                await this.audit.log({
                    entityType: 'BudgetLine',
                    entityId: updated.id,
                    action: 'UPDATE',
                    before: existing,
                    after: updated,
                    actorUserId: user.sub,
                });
                results.push({ status: 'updated', id: updated.id });
            }
            else {
                const created = await this.prisma.budgetLine.create({
                    data: {
                        scenarioId: dto.scenarioId,
                        costCenterId: costCenter.id,
                        accountId: account.id,
                        description: item.description,
                        driverType: item.driverType,
                        driverValue: item.driverValue ?? null,
                        monthlyValues: item.monthlyValues,
                        currency: 'BRL',
                        assumptions: item.assumptions ?? null,
                        createdById: user.sub,
                        updatedById: user.sub,
                    },
                });
                await this.audit.log({
                    entityType: 'BudgetLine',
                    entityId: created.id,
                    action: 'CREATE',
                    before: null,
                    after: created,
                    actorUserId: user.sub,
                });
                results.push({ status: 'inserted', id: created.id });
            }
        }
        return { scenarioId: dto.scenarioId, results };
    }
    async summary(scenarioId, groupBy, user) {
        if (!scenarioId) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
        }
        if (!/^[0-9a-fA-F-]{36}$/.test(scenarioId)) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_INVALID', message: 'scenarioId must be a UUID' });
        }
        const where = { scenarioId };
        if (user.role === client_1.Role.COORDINATOR) {
            where.costCenter = { ownerCoordinatorId: user.sub };
        }
        const lines = await this.prisma.budgetLine.findMany({
            where,
            include: { costCenter: true, account: true },
        });
        const itemsMap = new Map();
        for (const line of lines) {
            let groupId = '';
            let groupCode = '';
            let groupName = '';
            if (groupBy === 'costCenter') {
                groupId = line.costCenter.id;
                groupCode = line.costCenter.code;
                groupName = line.costCenter.name;
            }
            else if (groupBy === 'account') {
                groupId = line.account.id;
                groupCode = line.account.code;
                groupName = line.account.name;
            }
            else {
                groupId = line.account.category;
                groupCode = line.account.category;
                groupName = line.account.category;
            }
            const key = groupId;
            if (!itemsMap.has(key)) {
                const monthlyTotals = {};
                for (const monthKey of constants_1.MONTH_KEYS) {
                    monthlyTotals[monthKey] = 0;
                }
                itemsMap.set(key, { groupId, groupCode, groupName, monthlyTotals });
            }
            const entry = itemsMap.get(key);
            const values = (line.monthlyValues ?? {});
            for (const monthKey of constants_1.MONTH_KEYS) {
                const raw = values[monthKey] ?? 0;
                const value = typeof raw === 'number' ? raw : Number(raw);
                entry.monthlyTotals[monthKey] += Number.isFinite(value) ? value : 0;
            }
        }
        const items = Array.from(itemsMap.values())
            .map((entry) => {
            const monthly = {};
            let total = 0;
            for (const monthKey of constants_1.MONTH_KEYS) {
                const value = entry.monthlyTotals[monthKey] ?? 0;
                total += value;
                monthly[monthKey] = value.toFixed(2);
            }
            return {
                groupId: entry.groupId,
                groupCode: entry.groupCode,
                groupName: entry.groupName,
                monthlyValues: monthly,
                total: total.toFixed(2),
            };
        })
            .sort((a, b) => a.groupCode.localeCompare(b.groupCode, 'pt-BR', { sensitivity: 'base' }));
        return { items };
    }
};
exports.BudgetLinesService = BudgetLinesService;
exports.BudgetLinesService = BudgetLinesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], BudgetLinesService);
//# sourceMappingURL=budget-lines.service.js.map