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
exports.BscService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const status_1 = require("./domain/status");
let BscService = class BscService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMap() {
        const perspectives = await this.prisma.bscPerspective.findMany({
            orderBy: { orderIndex: 'asc' },
            include: {
                objectives: {
                    orderBy: { name: 'asc' },
                    include: {
                        indicators: {
                            orderBy: { code: 'asc' },
                            include: { yearTargets: { orderBy: { year: 'asc' } } },
                        },
                    },
                },
            },
        });
        return { perspectives };
    }
    async getIndicators(filters) {
        const where = {
            ...(filters.search
                ? {
                    OR: [
                        { code: { contains: filters.search, mode: 'insensitive' } },
                        { name: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(filters.responsible
                ? { responsible: { contains: filters.responsible, mode: 'insensitive' } }
                : {}),
            ...(filters.dataOwner
                ? { dataOwner: { contains: filters.dataOwner, mode: 'insensitive' } }
                : {}),
            ...(filters.process ? { process: { contains: filters.process, mode: 'insensitive' } } : {}),
            ...(filters.keyword
                ? { keywords: { contains: filters.keyword, mode: 'insensitive' } }
                : {}),
            ...(filters.level != null ? { level: filters.level } : {}),
            ...(filters.objective
                ? { objective: { name: { contains: filters.objective, mode: 'insensitive' } } }
                : {}),
            ...(filters.perspective
                ? { objective: { perspective: { name: filters.perspective } } }
                : {}),
        };
        return this.prisma.bscIndicator.findMany({
            where,
            orderBy: [{ code: 'asc' }],
            include: {
                objective: { include: { perspective: true } },
                yearTargets: { orderBy: { year: 'asc' } },
            },
        });
    }
    async getIndicatorByCode(code) {
        const indicator = await this.prisma.bscIndicator.findUnique({
            where: { code: code.toUpperCase() },
            include: {
                objective: { include: { perspective: true } },
                yearTargets: { orderBy: { year: 'asc' } },
                monthTargets: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
                monthActuals: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
                actionPlans: { orderBy: [{ sourceSheet: 'asc' }, { rowIndex: 'asc' }] },
            },
        });
        if (!indicator) {
            throw new common_1.NotFoundException({ code: 'BSC_INDICATOR_NOT_FOUND', message: 'Indicador não encontrado' });
        }
        const yearTargetsByYear = new Map(indicator.yearTargets.map((item) => [item.year, item.targetValue == null ? null : Number(item.targetValue)]));
        const monthTargetsByKey = new Map(indicator.monthTargets.map((item) => [`${item.year}-${item.month}`, item.targetValue == null ? null : Number(item.targetValue)]));
        const monthActualsByKey = new Map(indicator.monthActuals.map((item) => [`${item.year}-${item.month}`, item.actualValue == null ? null : Number(item.actualValue)]));
        const years = new Set();
        indicator.yearTargets.forEach((item) => years.add(item.year));
        indicator.monthTargets.forEach((item) => years.add(item.year));
        indicator.monthActuals.forEach((item) => years.add(item.year));
        const monthly = Array.from(years)
            .sort((a, b) => a - b)
            .flatMap((year) => Array.from({ length: 12 }, (_, idx) => {
            const month = idx + 1;
            const key = `${year}-${month}`;
            const hasMonthTarget = monthTargetsByKey.has(key);
            const target = hasMonthTarget ? (monthTargetsByKey.get(key) ?? null) : (yearTargetsByYear.get(year) ?? null);
            const actual = monthActualsByKey.has(key) ? (monthActualsByKey.get(key) ?? null) : null;
            const calc = (0, status_1.computeStatus)(target, actual, indicator.direction);
            return {
                year,
                month,
                target,
                actual,
                variance: target != null && actual != null && target !== 0 ? actual / target - 1 : null,
                attainment: calc.attainment,
                status: calc.status,
            };
        }));
        return { ...indicator, monthly };
    }
    async getManagement(year) {
        const indicators = await this.prisma.bscIndicator.findMany({
            orderBy: [{ code: 'asc' }],
            include: {
                objective: { include: { perspective: true } },
                monthTargets: { where: { year } },
                monthActuals: { where: { year } },
            },
        });
        const rows = indicators.map((indicator) => {
            const targetByMonth = new Map(indicator.monthTargets.map((item) => [
                item.month,
                item.targetValue == null ? null : Number(item.targetValue),
            ]));
            const actualByMonth = new Map(indicator.monthActuals.map((item) => [
                item.month,
                item.actualValue == null ? null : Number(item.actualValue),
            ]));
            const months = Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => {
                const target = targetByMonth.has(month) ? (targetByMonth.get(month) ?? null) : null;
                const actual = actualByMonth.has(month) ? (actualByMonth.get(month) ?? null) : null;
                const calc = (0, status_1.computeStatus)(target, actual, indicator.direction);
                return {
                    month,
                    target,
                    actual,
                    variance: target != null && actual != null && target !== 0 ? actual / target - 1 : null,
                    attainment: calc.attainment,
                    status: calc.status,
                };
            });
            return {
                indicatorId: indicator.id,
                code: indicator.code,
                name: indicator.name,
                perspective: indicator.objective.perspective.name,
                objective: indicator.objective.name,
                responsible: indicator.responsible,
                dataOwner: indicator.dataOwner,
                level: indicator.level,
                process: indicator.process,
                keywords: indicator.keywords,
                direction: indicator.direction,
                months,
            };
        });
        return { year, rows };
    }
    async getManagementSummary(year) {
        const management = await this.getManagement(year);
        const grouped = new Map();
        for (const row of management.rows) {
            const latest = [...row.months].reverse().find((m) => m.target != null || m.actual != null);
            const key = `${row.perspective}|${row.objective}`;
            const current = grouped.get(key) ?? { verde: 0, amarelo: 0, vermelho: 0, semDados: 0, total: 0 };
            current.total += 1;
            const status = latest?.status ?? 'NO_DATA';
            if (status === 'GREEN')
                current.verde += 1;
            else if (status === 'YELLOW')
                current.amarelo += 1;
            else if (status === 'RED')
                current.vermelho += 1;
            else
                current.semDados += 1;
            grouped.set(key, current);
        }
        return {
            year,
            grouped: Array.from(grouped.entries()).map(([key, value]) => {
                const [perspective, objective] = key.split('|');
                return { perspective, objective, ...value };
            }),
        };
    }
    async setIndicatorMonthActual(code, payload) {
        const indicator = await this.prisma.bscIndicator.findUnique({
            where: { code: code.toUpperCase() },
            select: { id: true, code: true },
        });
        if (!indicator) {
            throw new common_1.NotFoundException({ code: 'BSC_INDICATOR_NOT_FOUND', message: 'Indicador nao encontrado' });
        }
        const where = {
            indicatorId_year_month: {
                indicatorId: indicator.id,
                year: payload.year,
                month: payload.month,
            },
        };
        if (payload.actualValue === null || payload.actualValue === undefined) {
            await this.prisma.bscIndicatorMonthActual.deleteMany({
                where: {
                    indicatorId: indicator.id,
                    year: payload.year,
                    month: payload.month,
                },
            });
            return {
                indicatorCode: indicator.code,
                year: payload.year,
                month: payload.month,
                actualValue: null,
            };
        }
        const row = await this.prisma.bscIndicatorMonthActual.upsert({
            where,
            update: {
                actualValue: payload.actualValue,
                rawValue: String(payload.actualValue),
            },
            create: {
                indicatorId: indicator.id,
                year: payload.year,
                month: payload.month,
                actualValue: payload.actualValue,
                rawValue: String(payload.actualValue),
            },
        });
        return {
            indicatorCode: indicator.code,
            year: row.year,
            month: row.month,
            actualValue: row.actualValue == null ? null : Number(row.actualValue),
            rawValue: row.rawValue,
        };
    }
    async setIndicatorMonthTarget(code, payload) {
        const indicator = await this.prisma.bscIndicator.findUnique({
            where: { code: code.toUpperCase() },
            select: { id: true, code: true },
        });
        if (!indicator) {
            throw new common_1.NotFoundException({ code: 'BSC_INDICATOR_NOT_FOUND', message: 'Indicador não encontrado' });
        }
        const where = {
            indicatorId_year_month: {
                indicatorId: indicator.id,
                year: payload.year,
                month: payload.month,
            },
        };
        if (payload.targetValue === null || payload.targetValue === undefined) {
            await this.prisma.bscIndicatorMonthTarget.deleteMany({
                where: {
                    indicatorId: indicator.id,
                    year: payload.year,
                    month: payload.month,
                },
            });
            return {
                indicatorCode: indicator.code,
                year: payload.year,
                month: payload.month,
                targetValue: null,
            };
        }
        const row = await this.prisma.bscIndicatorMonthTarget.upsert({
            where,
            update: {
                targetValue: payload.targetValue,
                rawValue: String(payload.targetValue),
            },
            create: {
                indicatorId: indicator.id,
                year: payload.year,
                month: payload.month,
                targetValue: payload.targetValue,
                rawValue: String(payload.targetValue),
            },
        });
        return {
            indicatorCode: indicator.code,
            year: row.year,
            month: row.month,
            targetValue: row.targetValue == null ? null : Number(row.targetValue),
            rawValue: row.rawValue,
        };
    }
    getProjects(snapshot) {
        return this.prisma.bscProject.findMany({
            where: snapshot ? { snapshotDate: new Date(`${snapshot}T00:00:00.000Z`) } : undefined,
            orderBy: [{ snapshotDate: 'desc' }, { name: 'asc' }],
            include: { _count: { select: { tasks: true } } },
        });
    }
    async getProjectSnapshots() {
        const rows = await this.prisma.bscProject.findMany({
            distinct: ['snapshotDate'],
            select: { snapshotDate: true },
            orderBy: { snapshotDate: 'desc' },
        });
        return rows.map((row) => row.snapshotDate.toISOString().slice(0, 10));
    }
    async getProjectTasks(projectId) {
        const project = await this.prisma.bscProject.findUnique({
            where: { id: projectId },
            include: { tasks: { orderBy: [{ level: 'asc' }, { wbs: 'asc' }] } },
        });
        if (!project)
            throw new common_1.NotFoundException({ code: 'BSC_PROJECT_NOT_FOUND', message: 'Projeto não encontrado' });
        const byParent = new Map();
        project.tasks.forEach((task) => {
            const key = task.parentWbs ?? '__ROOT__';
            const list = byParent.get(key) ?? [];
            list.push(task);
            byParent.set(key, list);
        });
        const tree = (parentWbs) => {
            const list = byParent.get(parentWbs ?? '__ROOT__') ?? [];
            return list.map((item) => ({ ...item, children: tree(item.wbs) }));
        };
        return { ...project, taskTree: tree(null) };
    }
    getTaskSnapshots(taskId) {
        return this.prisma.bscTaskSnapshot.findMany({
            where: { taskId },
            orderBy: { snapshotDate: 'asc' },
        });
    }
};
exports.BscService = BscService;
exports.BscService = BscService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BscService);
//# sourceMappingURL=bsc.service.js.map