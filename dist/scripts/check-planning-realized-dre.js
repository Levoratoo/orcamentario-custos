"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dre_service_1 = require("../src/dre/dre.service");
const planning_service_1 = require("../src/planning/planning.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
function seriesTotal(values) {
    return values.reduce((acc, value) => acc + Number(value ?? 0), 0);
}
async function directDreRealizedByMonth(prisma, year, codes) {
    if (codes.length === 0)
        return new Array(12).fill(0);
    const budgets = await prisma.budget.findMany({
        where: {
            year,
            kind: { in: [client_1.BudgetKind.ACTUAL, client_1.BudgetKind.BUDGET] },
            status: client_1.BudgetStatus.READY,
        },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true, kind: true, isActive: true, updatedAt: true, name: true },
    });
    const prioritized = budgets.sort((left, right) => {
        if (left.kind !== right.kind)
            return left.kind === client_1.BudgetKind.ACTUAL ? -1 : 1;
        if (left.isActive !== right.isActive)
            return left.isActive ? -1 : 1;
        return Number(right.updatedAt) - Number(left.updatedAt);
    });
    for (const budget of prioritized) {
        const grouped = await prisma.dreLine.groupBy({
            by: ['month'],
            where: {
                budgetId: budget.id,
                mode: 'REALIZADO',
                accountCode: { in: codes },
            },
            _sum: { value: true },
        });
        const series = new Array(12).fill(0);
        grouped.forEach((item) => {
            if (item.month >= 1 && item.month <= 12) {
                series[item.month - 1] = Number(item._sum.value ?? 0);
            }
        });
        const total = seriesTotal(series);
        if (grouped.length > 0 || Math.abs(total) > 0.01) {
            return { series, budget: `${budget.kind}/${budget.name}` };
        }
    }
    return { series: new Array(12).fill(0), budget: 'NONE' };
}
function normalizeCodes(codes) {
    return Array.from(new Set(codes
        .map((code) => String(code ?? '').trim())
        .filter(Boolean)
        .flatMap((code) => {
        const base = code.split('.')[0]?.trim() ?? '';
        return base && base !== code ? [code, base] : [code];
    })));
}
function sameSeries(left, right) {
    return left.every((value, index) => Math.abs(value - (right[index] ?? 0)) < 0.01);
}
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dreService = new dre_service_1.DreService(prisma);
    const planningService = new planning_service_1.PlanningService(prisma, dreService);
    const proacoes = await prisma.proacao.findMany({
        include: { accounts: { select: { code: true } } },
        orderBy: { name: 'asc' },
    });
    for (const proacao of proacoes.slice(0, 8)) {
        const codes = normalizeCodes(proacao.accounts.map((item) => item.code));
        const summary = await planningService.getSummary({ sub: 'admin', role: 'ADMIN' }, proacao.id, 2026);
        const db2026 = await directDreRealizedByMonth(prisma, 2026, codes);
        const db2025 = await directDreRealizedByMonth(prisma, 2025, codes);
        const apiCur = summary.chart.series.realizadoAnoAtual;
        const apiPrev = summary.chart.series.realizadoAnoAnt;
        console.log(JSON.stringify({
            proacao: proacao.name,
            apiMatchesDb2026: sameSeries(apiCur, db2026.series),
            apiMatchesDb2025: sameSeries(apiPrev, db2025.series),
            totalApi2026: seriesTotal(apiCur),
            totalDb2026: seriesTotal(db2026.series),
            totalApi2025: seriesTotal(apiPrev),
            totalDb2025: seriesTotal(db2025.series),
            pickedBudget2026: db2026.budget,
            pickedBudget2025: db2025.budget,
        }, null, 2));
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-planning-realized-dre.js.map