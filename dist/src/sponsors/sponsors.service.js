"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SponsorsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const xlsx = __importStar(require("xlsx"));
const sync_1 = require("csv-parse/sync");
let SponsorsService = class SponsorsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBudget(budgetId) {
        const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
        if (!budget) {
            throw new common_1.NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
        }
        return budget;
    }
    calcVarPct(main, compare) {
        if (!compare)
            return null;
        return ((main - compare) / Math.max(Math.abs(compare), 1)) * 100;
    }
    async getPrevActualBudget(budgetYear) {
        return this.prisma.budget.findFirst({
            where: { year: budgetYear - 1, kind: 'ACTUAL', status: client_1.BudgetStatus.READY },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async ensureCanViewAccount(user, accountCode, costCenterId) {
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
            throw new common_1.ForbiddenException({ code: 'NOT_SPONSOR', message: 'Not allowed to view this account' });
        }
    }
    async listMyAccounts(budgetId, user) {
        const budget = await this.getBudget(budgetId);
        const sponsors = await this.prisma.accountSponsor.findMany({
            where: user.role === client_1.Role.ADMIN ? {} : { sponsorUserId: user.sub },
            orderBy: { accountCode: 'asc' },
        });
        const accountCodes = Array.from(new Set(sponsors.map((s) => s.accountCode)));
        const accounts = await this.prisma.account.findMany({ where: { code: { in: accountCodes } } });
        const accountByCode = new Map(accounts.map((acc) => [acc.code, acc.name]));
        const costCenters = await this.prisma.costCenter.findMany();
        const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc.name]));
        const items = await this.prisma.budgetItem.findMany({
            where: { budgetId, accountCode: { in: accountCodes } },
            include: { values: true },
        });
        const itemsByKey = new Map();
        items.forEach((item) => {
            const key = `${item.accountCode}::${item.costCenterId ?? 'none'}`;
            const list = itemsByKey.get(key) ?? [];
            list.push(item);
            itemsByKey.set(key, list);
        });
        const prevActual = await this.getPrevActualBudget(budget.year);
        const actualTotalsByAccount = new Map();
        if (prevActual) {
            const actualLines = await this.prisma.dreLine.findMany({
                where: { budgetId: prevActual.id, accountCode: { in: accountCodes }, mode: client_1.DreMode.REALIZADO },
            });
            if (actualLines.length === 0) {
                const fallback = await this.prisma.dreLine.findMany({
                    where: { budgetId: prevActual.id, accountCode: { in: accountCodes }, mode: client_1.DreMode.PREVISTO },
                });
                fallback.forEach((line) => {
                    actualTotalsByAccount.set(line.accountCode ?? '', (actualTotalsByAccount.get(line.accountCode ?? '') ?? 0) + Number(line.value));
                });
            }
            else {
                actualLines.forEach((line) => {
                    actualTotalsByAccount.set(line.accountCode ?? '', (actualTotalsByAccount.get(line.accountCode ?? '') ?? 0) + Number(line.value));
                });
            }
        }
        const rows = sponsors.map((sponsor) => {
            const key = `${sponsor.accountCode}::${sponsor.costCenterId ?? 'none'}`;
            const relatedItems = itemsByKey.get(key) ?? [];
            const itemsCount = relatedItems.length;
            const filledItemsCount = relatedItems.filter((item) => {
                const total = item.values.reduce((sum, value) => sum + Number(value.value), 0);
                return item.isActive && total !== 0;
            }).length;
            const scenarioTotal = relatedItems
                .filter((item) => item.isActive)
                .reduce((sum, item) => sum + item.values.reduce((acc, value) => acc + Number(value.value), 0), 0);
            const actualPrevYearTotal = actualTotalsByAccount.get(sponsor.accountCode) ?? 0;
            const varPct = this.calcVarPct(scenarioTotal, actualPrevYearTotal);
            const status = itemsCount === 0 || scenarioTotal === 0
                ? 'PENDING'
                : relatedItems.some((item) => item.isActive && item.values.reduce((sum, value) => sum + Number(value.value), 0) === 0)
                    ? 'IN_PROGRESS'
                    : 'DONE';
            return {
                accountCode: sponsor.accountCode,
                accountName: accountByCode.get(sponsor.accountCode) ?? sponsor.accountCode,
                costCenterId: sponsor.costCenterId,
                costCenterName: sponsor.costCenterId ? costCenterById.get(sponsor.costCenterId) ?? null : null,
                sponsor: { userId: sponsor.sponsorUserId, display: sponsor.sponsorDisplay },
                actualPrevYearTotal,
                scenarioTotal,
                varPct,
                itemsCount,
                filledItemsCount,
                status,
            };
        });
        return { budgetId, rows };
    }
    async getAccountDetails(accountCode, budgetId, costCenterId, user) {
        const budget = await this.getBudget(budgetId);
        await this.ensureCanViewAccount(user, accountCode, costCenterId);
        const account = await this.prisma.account.findUnique({ where: { code: accountCode } });
        const costCenter = costCenterId ? await this.prisma.costCenter.findUnique({ where: { id: costCenterId } }) : null;
        const items = await this.prisma.budgetItem.findMany({
            where: { budgetId, accountCode, costCenterId: costCenterId ?? null },
            include: { values: true },
            orderBy: { createdAt: 'asc' },
        });
        const itemsPayload = items.map((item) => {
            const monthValues = {};
            item.values.forEach((value) => {
                monthValues[value.month] = Number(value.value);
            });
            const total = Object.values(monthValues).reduce((sum, value) => sum + value, 0);
            return {
                id: item.id,
                itemName: item.itemName,
                isActive: item.isActive,
                isReimbursement: item.isReimbursement,
                comment: item.comment,
                monthValues,
                total,
            };
        });
        const scenarioMonthly = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const value = items
                .filter((item) => item.isActive)
                .reduce((sum, item) => {
                const entry = item.values.find((val) => val.month === month);
                return sum + Number(entry?.value ?? 0);
            }, 0);
            return { month, value };
        });
        const scenarioTotal = scenarioMonthly.reduce((sum, entry) => sum + entry.value, 0);
        const prevActual = await this.getPrevActualBudget(budget.year);
        let actualPrevYearMonthly = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: 0 }));
        if (prevActual) {
            const lines = await this.prisma.dreLine.findMany({
                where: { budgetId: prevActual.id, accountCode, mode: client_1.DreMode.REALIZADO },
            });
            const fallback = lines.length === 0
                ? await this.prisma.dreLine.findMany({ where: { budgetId: prevActual.id, accountCode, mode: client_1.DreMode.PREVISTO } })
                : lines;
            const monthlyMap = new Map();
            fallback.forEach((line) => {
                if (!line.month)
                    return;
                monthlyMap.set(line.month, (monthlyMap.get(line.month) ?? 0) + Number(line.value));
            });
            actualPrevYearMonthly = actualPrevYearMonthly.map((entry) => ({
                month: entry.month,
                value: monthlyMap.get(entry.month) ?? 0,
            }));
        }
        const actualPrevYearTotal = actualPrevYearMonthly.reduce((sum, entry) => sum + entry.value, 0);
        const varPctTotal = this.calcVarPct(scenarioTotal, actualPrevYearTotal);
        const varPctMonthly = scenarioMonthly.map((entry) => ({
            month: entry.month,
            value: this.calcVarPct(entry.value, actualPrevYearMonthly.find((a) => a.month === entry.month)?.value ?? 0),
        }));
        return {
            budget: { id: budget.id, name: budget.name, year: budget.year },
            account: { code: accountCode, name: account?.name ?? accountCode },
            costCenter: costCenter ? { id: costCenter.id, name: costCenter.name } : null,
            permission: { canEdit: user.role === client_1.Role.ADMIN || user.role === client_1.Role.CONTROLLER || user.role === client_1.Role.COORDINATOR, isAdmin: user.role === client_1.Role.ADMIN },
            items: itemsPayload,
            totals: {
                scenarioTotal,
                scenarioMonthly,
                actualPrevYearTotal,
                actualPrevYearMonthly,
                varPctTotal,
                varPctMonthly,
            },
        };
    }
    async listSponsors(query) {
        if (!query) {
            return this.prisma.accountSponsor.findMany({ orderBy: { accountCode: 'asc' } });
        }
        return this.prisma.accountSponsor.findMany({
            where: {
                OR: [
                    { accountCode: { contains: query, mode: 'insensitive' } },
                    { sponsorDisplay: { contains: query, mode: 'insensitive' } },
                ],
            },
            orderBy: { accountCode: 'asc' },
        });
    }
    async createSponsor(dto) {
        let display = dto.sponsorDisplay?.trim();
        if (dto.sponsorUserId) {
            const user = await this.prisma.user.findUnique({ where: { id: dto.sponsorUserId } });
            display = display || user?.name || 'Sponsor';
        }
        if (!display) {
            throw new common_1.BadRequestException({ code: 'SPONSOR_DISPLAY_REQUIRED', message: 'Sponsor display required' });
        }
        return this.prisma.accountSponsor.create({
            data: {
                accountCode: dto.accountCode,
                costCenterId: dto.costCenterId ?? null,
                sponsorUserId: dto.sponsorUserId ?? null,
                sponsorDisplay: display,
            },
        });
    }
    async updateSponsor(id, dto) {
        const sponsor = await this.prisma.accountSponsor.findUnique({ where: { id } });
        if (!sponsor) {
            throw new common_1.NotFoundException({ code: 'SPONSOR_NOT_FOUND', message: 'Sponsor not found' });
        }
        return this.prisma.accountSponsor.update({
            where: { id },
            data: {
                accountCode: dto.accountCode,
                costCenterId: dto.costCenterId,
                sponsorUserId: dto.sponsorUserId,
                sponsorDisplay: dto.sponsorDisplay,
            },
        });
    }
    async deleteSponsor(id) {
        await this.prisma.accountSponsor.delete({ where: { id } });
        return { ok: true };
    }
    async importSponsors(file) {
        const rows = this.parseSponsorFile(file);
        const costCenters = await this.prisma.costCenter.findMany();
        const costCenterByCode = new Map(costCenters.map((cc) => [cc.code, cc.id]));
        const results = [];
        for (const row of rows) {
            const costCenterId = row.costCenterCode ? costCenterByCode.get(row.costCenterCode) ?? null : null;
            const sponsorUser = row.sponsorEmail
                ? await this.prisma.user.findUnique({ where: { email: row.sponsorEmail } })
                : null;
            const display = row.sponsorDisplay ?? sponsorUser?.name ?? row.sponsorEmail ?? row.sponsorName ?? 'Sponsor';
            const existing = await this.prisma.accountSponsor.findFirst({
                where: { accountCode: row.accountCode, costCenterId },
            });
            if (existing) {
                await this.prisma.accountSponsor.update({
                    where: { id: existing.id },
                    data: {
                        sponsorUserId: sponsorUser?.id ?? null,
                        sponsorDisplay: display,
                    },
                });
                results.push({ accountCode: row.accountCode, status: 'updated' });
            }
            else {
                await this.prisma.accountSponsor.create({
                    data: {
                        accountCode: row.accountCode,
                        costCenterId,
                        sponsorUserId: sponsorUser?.id ?? null,
                        sponsorDisplay: display,
                    },
                });
                results.push({ accountCode: row.accountCode, status: 'created' });
            }
        }
        return { total: results.length, results };
    }
    parseSponsorFile(file) {
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        let rows = [];
        if (ext === 'csv') {
            const csvText = file.buffer.toString('utf8');
            const records = (0, sync_1.parse)(csvText, { columns: true, skip_empty_lines: true });
            rows = records;
        }
        else {
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = xlsx.utils.sheet_to_json(sheet);
        }
        return rows.map((row) => ({
            accountCode: String(row['CONTA'] ?? row['conta'] ?? row['Conta']).trim(),
            sponsorEmail: row['PADRINHO'] ?? row['padrinho'] ?? row['Sponsor'] ?? '',
            sponsorName: row['NOME'] ?? row['Nome'] ?? '',
            sponsorDisplay: row['DISPLAY'] ?? row['Display'] ?? '',
            costCenterCode: row['CENTRO_CUSTO'] ?? row['Centro_Custo'] ?? row['CUSTO'] ?? '',
        }));
    }
};
exports.SponsorsService = SponsorsService;
exports.SponsorsService = SponsorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SponsorsService);
//# sourceMappingURL=sponsors.service.js.map