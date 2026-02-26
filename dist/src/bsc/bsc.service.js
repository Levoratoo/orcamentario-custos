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
const prisma_service_1 = require("../prisma/prisma.service");
const bsc_utils_1 = require("./bsc.utils");
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
    async getIndicators(params) {
        const where = {
            ...(params.responsible ? { responsible: { contains: params.responsible, mode: 'insensitive' } } : {}),
            ...(params.process ? { process: { contains: params.process, mode: 'insensitive' } } : {}),
            ...(params.search
                ? {
                    OR: [
                        { code: { contains: params.search, mode: 'insensitive' } },
                        { name: { contains: params.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(params.objective
                ? { objective: { name: { contains: params.objective, mode: 'insensitive' } } }
                : {}),
            ...(params.perspective
                ? { objective: { perspective: { name: params.perspective } } }
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
        const monthMap = new Map();
        indicator.monthTargets.forEach((item) => {
            monthMap.set(`${item.year}-${item.month}`, {
                year: item.year,
                month: item.month,
                target: item.targetValue == null ? null : Number(item.targetValue),
                actual: null,
            });
        });
        indicator.monthActuals.forEach((item) => {
            const key = `${item.year}-${item.month}`;
            const current = monthMap.get(key) ?? {
                year: item.year,
                month: item.month,
                target: null,
                actual: null,
            };
            current.actual = item.actualValue == null ? null : Number(item.actualValue);
            monthMap.set(key, current);
        });
        const monthly = Array.from(monthMap.values())
            .sort((a, b) => (a.year - b.year) || (a.month - b.month))
            .map((entry) => {
            const calc = (0, bsc_utils_1.computeIndicatorStatus)(entry.target, entry.actual, indicator.direction);
            return {
                ...entry,
                variance: entry.target != null && entry.actual != null && entry.target !== 0
                    ? entry.actual / entry.target - 1
                    : null,
                attainment: calc.attainment,
                status: calc.status,
            };
        });
        return {
            ...indicator,
            monthly,
        };
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
            const targets = new Map(indicator.monthTargets.map((item) => [item.month, Number(item.targetValue ?? 0)]));
            const actuals = new Map(indicator.monthActuals.map((item) => [item.month, Number(item.actualValue ?? 0)]));
            const months = Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                const target = targets.has(month) ? Number(targets.get(month)) : null;
                const actual = actuals.has(month) ? Number(actuals.get(month)) : null;
                const calc = (0, bsc_utils_1.computeIndicatorStatus)(target, actual, indicator.direction);
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
                process: indicator.process,
                direction: indicator.direction,
                months,
            };
        });
        return { year, rows };
    }
    async getManagementSummary(year) {
        const management = await this.getManagement(year);
        const groups = new Map();
        for (const row of management.rows) {
            const latestMonth = [...row.months].reverse().find((month) => month.target != null || month.actual != null);
            const status = latestMonth?.status ?? 'SEM_DADOS';
            const key = `${row.perspective}|${row.objective}`;
            const current = groups.get(key) ?? { verde: 0, amarelo: 0, vermelho: 0, semDados: 0, total: 0 };
            current.total += 1;
            if (status === 'VERDE')
                current.verde += 1;
            else if (status === 'AMARELO')
                current.amarelo += 1;
            else if (status === 'VERMELHO')
                current.vermelho += 1;
            else
                current.semDados += 1;
            groups.set(key, current);
        }
        const grouped = Array.from(groups.entries()).map(([key, value]) => {
            const [perspective, objective] = key.split('|');
            return { perspective, objective, ...value };
        });
        return { year, grouped };
    }
    async getProjects(snapshot) {
        return this.prisma.bscProject.findMany({
            where: snapshot ? { snapshotDate: new Date(`${snapshot}T00:00:00.000Z`) } : undefined,
            orderBy: [{ snapshotDate: 'desc' }, { name: 'asc' }],
            include: { _count: { select: { tasks: true } } },
        });
    }
    async getProjectSnapshots() {
        const snapshots = await this.prisma.bscProject.findMany({
            distinct: ['snapshotDate'],
            select: { snapshotDate: true },
            orderBy: { snapshotDate: 'desc' },
        });
        return snapshots.map((item) => item.snapshotDate.toISOString().slice(0, 10));
    }
    async getProjectTasks(projectId) {
        const project = await this.prisma.bscProject.findUnique({
            where: { id: projectId },
            include: { tasks: { orderBy: [{ level: 'asc' }, { wbs: 'asc' }] } },
        });
        if (!project) {
            throw new common_1.NotFoundException({ code: 'BSC_PROJECT_NOT_FOUND', message: 'Projeto não encontrado' });
        }
        const byParent = new Map();
        project.tasks.forEach((task) => {
            const key = task.parentWbs ?? '__ROOT__';
            const list = byParent.get(key) ?? [];
            list.push(task);
            byParent.set(key, list);
        });
        const buildTree = (parentWbs) => {
            const list = byParent.get(parentWbs ?? '__ROOT__') ?? [];
            return list.map((task) => ({
                ...task,
                children: buildTree(task.wbs),
            }));
        };
        return {
            ...project,
            taskTree: buildTree(null),
        };
    }
    async getTaskSnapshots(taskId) {
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