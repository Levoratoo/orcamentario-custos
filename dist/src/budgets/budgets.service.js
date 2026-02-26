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
exports.BudgetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const budget_importer_1 = require("./budget-importer");
function inferYearFromColumns(columns) {
    for (const col of columns) {
        const match = col.label.match(/(?:^|\D)(\d{2})\/(\d{4})(?:\D|$)/);
        if (match) {
            const year = Number(match[2]);
            if (Number.isFinite(year))
                return year;
        }
    }
    return null;
}
let BudgetsService = class BudgetsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        return this.prisma.budget.findMany({
            orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
        });
    }
    async get(id) {
        const budget = await this.prisma.budget.findUnique({ where: { id } });
        if (!budget) {
            throw new common_1.NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
        }
        return budget;
    }
    async listImports(id) {
        await this.get(id);
        return this.prisma.budgetImport.findMany({
            where: { budgetId: id },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    async create(dto) {
        return this.prisma.budget.create({
            data: {
                name: dto.name,
                year: dto.year,
                kind: dto.kind ?? client_1.BudgetKind.BUDGET,
                notes: dto.notes,
                status: client_1.BudgetStatus.DRAFT,
            },
        });
    }
    async update(id, dto) {
        await this.get(id);
        return this.prisma.budget.update({
            where: { id },
            data: {
                name: dto.name,
                year: dto.year,
                kind: dto.kind,
                status: dto.status,
                notes: dto.notes,
            },
        });
    }
    async delete(id) {
        await this.get(id);
        return this.prisma.budget.delete({ where: { id } });
    }
    async duplicate(id, copyLines = true) {
        const budget = await this.get(id);
        const clone = await this.prisma.budget.create({
            data: {
                name: `${budget.name} (copia)`,
                year: budget.year,
                kind: budget.kind,
                status: client_1.BudgetStatus.DRAFT,
                notes: budget.notes,
                version: 1,
            },
        });
        if (copyLines) {
            const lines = await this.prisma.dreLine.findMany({ where: { budgetId: id } });
            if (lines.length > 0) {
                await this.prisma.dreLine.createMany({
                    data: lines.map((line) => ({
                        budgetId: clone.id,
                        nodeKey: line.nodeKey,
                        parentKey: line.parentKey,
                        level: line.level,
                        sortOrder: line.sortOrder,
                        accountCode: line.accountCode,
                        accountName: line.accountName,
                        groupPath: line.groupPath,
                        month: line.month,
                        mode: line.mode,
                        value: line.value,
                    })),
                });
                await this.prisma.budget.update({
                    where: { id: clone.id },
                    data: { status: client_1.BudgetStatus.READY },
                });
            }
        }
        return clone;
    }
    async setActive(id) {
        const budget = await this.get(id);
        await this.prisma.$transaction([
            this.prisma.budget.updateMany({
                where: { kind: budget.kind, isActive: true },
                data: { isActive: false },
            }),
            this.prisma.budget.update({
                where: { id },
                data: { isActive: true },
            }),
        ]);
        return { ok: true };
    }
    async importFile(id, file) {
        const budget = await this.get(id);
        const nextVersion = budget.version + 1;
        await this.prisma.budget.update({
            where: { id },
            data: {
                status: client_1.BudgetStatus.PROCESSING,
                errorMessage: null,
            },
        });
        const importRecord = await this.prisma.budgetImport.create({
            data: {
                budgetId: id,
                version: nextVersion,
                fileName: file.originalname,
                status: client_1.BudgetStatus.PROCESSING,
            },
        });
        try {
            const parsed = (0, budget_importer_1.parseDreFile)(file.buffer, file.originalname);
            const rows = parsed.rows;
            const columns = parsed.columns;
            const yearFromFile = inferYearFromColumns(columns);
            const targetYear = yearFromFile ?? budget.year;
            const budgetLines = [];
            const actualLines = [];
            const stack = [];
            rows.forEach((row, rowIndex) => {
                const label = row.label.replace(/\s+/g, ' ').trim();
                const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
                const accountCode = match?.[1];
                const accountName = (match?.[2] ?? label).trim();
                const nodeKey = `${accountCode ?? accountName}-${rowIndex}`;
                const level = row.level ?? 0;
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }
                const parentKey = stack.length > 0 ? stack[stack.length - 1].key : null;
                stack.push({ level, key: nodeKey });
                const groupPath = stack.map((item) => item.key).join(' > ');
                columns.forEach((col, colIndex) => {
                    if (col.label === 'Total')
                        return;
                    if (!col.month)
                        return;
                    const value = Number(row.values?.[colIndex] ?? 0);
                    const mode = col.mode ?? client_1.DreMode.PREVISTO;
                    const payload = {
                        budgetId: id,
                        nodeKey,
                        parentKey,
                        level,
                        sortOrder: rowIndex,
                        accountCode,
                        accountName,
                        groupPath,
                        month: col.month,
                        mode,
                        value,
                    };
                    if (mode === client_1.DreMode.REALIZADO) {
                        actualLines.push(payload);
                    }
                    else {
                        budgetLines.push(payload);
                    }
                });
            });
            if (budgetLines.length === 0 && actualLines.length === 0) {
                throw new common_1.BadRequestException({ code: 'BUDGET_IMPORT_EMPTY', message: 'Nenhuma linha encontrada.' });
            }
            const actualBudget = actualLines.length
                ? await this.prisma.budget.findFirst({
                    where: { year: targetYear, kind: client_1.BudgetKind.ACTUAL },
                    orderBy: { updatedAt: 'desc' },
                })
                : null;
            const ensureActualBudget = async () => {
                if (!actualLines.length)
                    return null;
                if (actualBudget)
                    return actualBudget;
                return this.prisma.budget.create({
                    data: {
                        name: `Realizado ${targetYear}`,
                        year: targetYear,
                        kind: client_1.BudgetKind.ACTUAL,
                        status: client_1.BudgetStatus.READY,
                        version: 1,
                        isActive: false,
                    },
                });
            };
            const actualTarget = await ensureActualBudget();
            const closingMonth = actualLines.length
                ? Math.max(...actualLines.map((line) => line.month ?? 0), 0)
                : null;
            await this.prisma.$transaction([
                this.prisma.dreLine.deleteMany({ where: { budgetId: id } }),
                budgetLines.length > 0 ? this.prisma.dreLine.createMany({ data: budgetLines }) : this.prisma.budget.findMany({ take: 0 }),
                this.prisma.budget.update({
                    where: { id },
                    data: {
                        status: client_1.BudgetStatus.READY,
                        version: nextVersion,
                        fileName: file.originalname,
                        errorMessage: null,
                        year: targetYear,
                    },
                }),
                this.prisma.budgetImport.update({
                    where: { id: importRecord.id },
                    data: { status: client_1.BudgetStatus.READY },
                }),
                actualTarget && actualLines.length > 0
                    ? this.prisma.dreLine.deleteMany({ where: { budgetId: actualTarget.id } })
                    : this.prisma.budget.findMany({ take: 0 }),
                actualTarget && actualLines.length > 0
                    ? this.prisma.dreLine.createMany({
                        data: actualLines.map((line) => ({ ...line, budgetId: actualTarget.id })),
                    })
                    : this.prisma.budget.findMany({ take: 0 }),
                actualTarget && actualLines.length > 0
                    ? this.prisma.budget.update({
                        where: { id: actualTarget.id },
                        data: { status: client_1.BudgetStatus.READY },
                    })
                    : this.prisma.budget.findMany({ take: 0 }),
                closingMonth && targetYear
                    ? this.prisma.closingMonth.upsert({
                        where: { year_kind: { year: targetYear, kind: client_1.BudgetKind.ACTUAL } },
                        update: { closingMonth },
                        create: { year: targetYear, kind: client_1.BudgetKind.ACTUAL, closingMonth },
                    })
                    : this.prisma.budget.findMany({ take: 0 }),
            ]);
            return { ok: true, version: nextVersion };
        }
        catch (error) {
            await this.prisma.budget.update({
                where: { id },
                data: { status: client_1.BudgetStatus.ERROR, errorMessage: error?.message ?? 'Falha ao importar' },
            });
            await this.prisma.budgetImport.update({
                where: { id: importRecord.id },
                data: { status: client_1.BudgetStatus.ERROR, errorMessage: error?.message ?? 'Falha ao importar' },
            });
            throw error;
        }
    }
};
exports.BudgetsService = BudgetsService;
exports.BudgetsService = BudgetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BudgetsService);
//# sourceMappingURL=budgets.service.js.map