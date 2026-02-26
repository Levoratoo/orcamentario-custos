"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dre_service_1 = require("../src/dre/dre.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
function toBaseCode(code) {
    const raw = String(code ?? '').trim();
    if (!raw)
        return '';
    return raw.split('.')[0] ?? raw;
}
(async () => {
    const prisma = new client_1.PrismaClient();
    await prisma.$connect();
    const budget2026 = await prisma.budget.findFirst({
        where: { year: 2026, kind: 'BUDGET', status: 'READY' },
        orderBy: { updatedAt: 'desc' },
    });
    if (!budget2026)
        throw new Error('Budget 2026 not found');
    const prismaService = new prisma_service_1.PrismaService();
    await prismaService.$connect();
    const dreService = new dre_service_1.DreService(prismaService);
    const dre = await dreService.getTree(budget2026.id, 'DRE');
    const dreByCode = new Map();
    dre.rows.forEach((row) => {
        const code = String(row.codigo ?? '').trim();
        if (!code)
            return;
        const months = {};
        let total = 0;
        Object.entries(row.valoresPorMes ?? {}).forEach(([monthKey, values]) => {
            const m = Number(String(monthKey).split('-')[1]);
            const previsto = Number(values?.previsto ?? 0);
            months[m] = (months[m] ?? 0) + previsto;
            total += previsto;
        });
        dreByCode.set(code, { months, total });
    });
    const planningAccounts = await prisma.planningAccount.findMany({
        where: { values: { some: { year: 2026 } } },
        include: { values: { where: { year: 2026 }, select: { month: true, value: true } } },
    });
    const planningAggByCode = new Map();
    planningAccounts.forEach((acc) => {
        const base = toBaseCode(acc.code);
        if (!base || !/^\d+$/.test(base))
            return;
        const bucket = planningAggByCode.get(base) ?? { months: {}, total: 0 };
        for (let m = 1; m <= 12; m += 1) {
            const v = Number(acc.values.find((x) => x.month === m)?.value ?? 0);
            bucket.months[m] = (bucket.months[m] ?? 0) + v;
            bucket.total += v;
        }
        planningAggByCode.set(base, bucket);
    });
    let matched = 0;
    let exact = 0;
    let withDiff = 0;
    let missingInDre = 0;
    const topDiffs = [];
    planningAggByCode.forEach((plan, code) => {
        const dreRow = dreByCode.get(code);
        if (!dreRow) {
            missingInDre += 1;
            topDiffs.push({ code, dreTotal: 0, planTotal: plan.total, delta: plan.total, monthDiffs: ['MISSING_DRE'] });
            return;
        }
        matched += 1;
        const monthDiffs = [];
        for (let m = 1; m <= 12; m += 1) {
            const d = Number(dreRow.months[m] ?? 0);
            const p = Number(plan.months[m] ?? 0);
            const delta = p - d;
            if (Math.abs(delta) > 0.01)
                monthDiffs.push({ month: m, delta });
        }
        const deltaTotal = plan.total - dreRow.total;
        if (monthDiffs.length === 0 && Math.abs(deltaTotal) <= 0.01) {
            exact += 1;
        }
        else {
            withDiff += 1;
            topDiffs.push({ code, dreTotal: dreRow.total, planTotal: plan.total, delta: deltaTotal, monthDiffs: monthDiffs.slice(0, 4) });
        }
    });
    topDiffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    console.log(JSON.stringify({
        planningBaseCodes: planningAggByCode.size,
        dreCodes: dreByCode.size,
        matchedCodes: matched,
        exactMatches: exact,
        codesWithDiff: withDiff,
        codesMissingInDre: missingInDre,
        topDiffs: topDiffs.slice(0, 20),
    }, null, 2));
    await prismaService.$disconnect();
    await prisma.$disconnect();
})();
//# sourceMappingURL=cross-dre-planning-2026-after.js.map