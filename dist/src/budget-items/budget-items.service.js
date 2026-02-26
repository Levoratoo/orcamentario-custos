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
exports.BudgetItemsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let BudgetItemsService = class BudgetItemsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureBudgetExists(budgetId) {
        const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
        if (!budget) {
            throw new common_1.NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
        }
        return budget;
    }
    async ensureCanEdit(user, accountCode, costCenterId) {
        if (user.role === client_1.Role.ADMIN)
            return;
        const sponsor = await this.prisma.accountSponsor.findFirst({
            where: {
                accountCode,
                sponsorUserId: user.sub,
                ...(costCenterId
                    ? { OR: [{ costCenterId }, { costCenterId: null }] }
                    : { costCenterId: null }),
            },
        });
        if (!sponsor) {
            throw new common_1.ForbiddenException({ code: 'NOT_SPONSOR', message: 'Not allowed to edit this account' });
        }
    }
    async getItem(itemId) {
        const item = await this.prisma.budgetItem.findUnique({
            where: { id: itemId },
        });
        if (!item) {
            throw new common_1.NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Budget item not found' });
        }
        return item;
    }
    async create(dto, user) {
        await this.ensureBudgetExists(dto.budgetId);
        await this.ensureCanEdit(user, dto.accountCode, dto.costCenterId ?? null);
        const item = await this.prisma.budgetItem.create({
            data: {
                budgetId: dto.budgetId,
                accountCode: dto.accountCode,
                costCenterId: dto.costCenterId ?? null,
                itemName: dto.itemName,
                isReimbursement: dto.isReimbursement ?? false,
                comment: dto.comment ?? null,
                createdByUserId: user.sub,
            },
        });
        const values = Array.from({ length: 12 }).map((_, index) => ({
            budgetItemId: item.id,
            month: index + 1,
            value: 0,
        }));
        await this.prisma.budgetItemValue.createMany({ data: values });
        return this.getWithValues(item.id);
    }
    async update(itemId, dto, user) {
        const item = await this.getItem(itemId);
        await this.ensureCanEdit(user, item.accountCode, item.costCenterId);
        await this.prisma.budgetItem.update({
            where: { id: itemId },
            data: {
                itemName: dto.itemName,
                isActive: dto.isActive,
                isReimbursement: dto.isReimbursement,
                comment: dto.comment,
            },
        });
        return this.getWithValues(itemId);
    }
    async delete(itemId, user) {
        const item = await this.getItem(itemId);
        await this.ensureCanEdit(user, item.accountCode, item.costCenterId);
        await this.prisma.budgetItem.delete({ where: { id: itemId } });
        return { ok: true };
    }
    async updateValues(itemId, dto, user) {
        const item = await this.getItem(itemId);
        await this.ensureCanEdit(user, item.accountCode, item.costCenterId);
        const updates = dto.values.map((entry) => this.prisma.budgetItemValue.upsert({
            where: { budgetItemId_month: { budgetItemId: itemId, month: entry.month } },
            update: { value: entry.value },
            create: { budgetItemId: itemId, month: entry.month, value: entry.value },
        }));
        await this.prisma.$transaction(updates);
        return this.getWithValues(itemId);
    }
    async applyValue(itemId, dto, user) {
        const months = dto.months === 'ALL' || !dto.monthList ? Array.from({ length: 12 }, (_, i) => i + 1) : dto.monthList;
        return this.updateValues(itemId, { values: months.map((month) => ({ month, value: dto.value })) }, user);
    }
    async copyFromMonth(itemId, dto, user) {
        const source = await this.prisma.budgetItemValue.findUnique({
            where: { budgetItemId_month: { budgetItemId: itemId, month: dto.fromMonth } },
        });
        if (!source) {
            throw new common_1.BadRequestException({ code: 'MONTH_NOT_FOUND', message: 'Mes de origem nao encontrado' });
        }
        const months = dto.months === 'ALL' || !dto.monthList ? Array.from({ length: 12 }, (_, i) => i + 1) : dto.monthList;
        return this.updateValues(itemId, { values: months.map((month) => ({ month, value: Number(source.value) })) }, user);
    }
    async distributeTotal(itemId, dto, user) {
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        if (dto.strategy === 'CUSTOM') {
            if (!dto.weights || dto.weights.length !== 12) {
                throw new common_1.BadRequestException({ code: 'INVALID_WEIGHTS', message: 'Weights precisam ter 12 valores' });
            }
            const totalWeight = dto.weights.reduce((sum, val) => sum + val, 0);
            if (totalWeight === 0) {
                throw new common_1.BadRequestException({ code: 'INVALID_WEIGHTS', message: 'Weights invalidos' });
            }
            const values = months.map((month, index) => ({
                month,
                value: (dto.annualTotal * dto.weights[index]) / totalWeight,
            }));
            return this.updateValues(itemId, { values }, user);
        }
        const equalValue = dto.annualTotal / 12;
        return this.updateValues(itemId, { values: months.map((month) => ({ month, value: equalValue })) }, user);
    }
    async getWithValues(itemId) {
        const item = await this.prisma.budgetItem.findUnique({
            where: { id: itemId },
            include: { values: true },
        });
        if (!item) {
            throw new common_1.NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Budget item not found' });
        }
        const monthValues = {};
        item.values.forEach((value) => {
            monthValues[value.month] = Number(value.value);
        });
        const total = Object.values(monthValues).reduce((sum, value) => sum + value, 0);
        return {
            id: item.id,
            budgetId: item.budgetId,
            accountCode: item.accountCode,
            costCenterId: item.costCenterId,
            itemName: item.itemName,
            isActive: item.isActive,
            isReimbursement: item.isReimbursement,
            comment: item.comment,
            monthValues,
            total,
        };
    }
};
exports.BudgetItemsService = BudgetItemsService;
exports.BudgetItemsService = BudgetItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BudgetItemsService);
//# sourceMappingURL=budget-items.service.js.map