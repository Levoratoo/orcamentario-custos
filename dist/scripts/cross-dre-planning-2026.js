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
        dreByCode.set(code, { descricao: row.descricao, months, total });
    });
    const planningAccounts = await prisma.planningAccount.findMany({
        where: { values: { some: { year: 2026 } } },
        include: {
            owner: { select: { id: true, name: true } },
            proacao: { select: { name: true } },
            values: { where: { year: 2026 }, select: { month: true, value: true } },
        },
    });
    const planningAggByCode = new Map();
    const missingCodeAccounts = [];
    planningAccounts.forEach((acc) => {
        const base = toBaseCode(acc.code);
        if (!base || !/^\d+$/.test(base)) {
            missingCodeAccounts.push({ coordinator: acc.owner.name, code: acc.code, label: acc.label, proacao: acc.proacao.name });
            return;
        }
        const bucket = planningAggByCode.get(base) ?? { months: {}, total: 0, accounts: 0 };
        bucket.accounts += 1;
        for (let m = 1; m <= 12; m += 1) {
            const v = Number(acc.values.find((x) => x.month === m)?.value ?? 0);
            bucket.months[m] = (bucket.months[m] ?? 0) + v;
            bucket.total += v;
        }
        planningAggByCode.set(base, bucket);
    });
    const compareRows = [];
    let matched = 0;
    let exact = 0;
    let withDiff = 0;
    let missingInDre = 0;
    planningAggByCode.forEach((plan, code) => {
        const dreRow = dreByCode.get(code);
        if (!dreRow) {
            missingInDre += 1;
            compareRows.push({
                code,
                dreTotal: 0,
                planTotal: plan.total,
                delta: plan.total,
                deltaPct: null,
                monthDiffs: [],
            });
            return;
        }
        matched += 1;
        const monthDiffs = [];
        for (let m = 1; m <= 12; m += 1) {
            const d = Number(dreRow.months[m] ?? 0);
            const p = Number(plan.months[m] ?? 0);
            const delta = p - d;
            if (Math.abs(delta) > 0.01) {
                monthDiffs.push({ month: m, dre: d, plan: p, delta });
            }
        }
        const delta = plan.total - dreRow.total;
        const deltaPct = Math.abs(dreRow.total) < 0.0001 ? null : delta / dreRow.total;
        if (monthDiffs.length === 0 && Math.abs(delta) <= 0.01) {
            exact += 1;
        }
        else {
            withDiff += 1;
        }
        compareRows.push({
            code,
            descricao: dreRow.descricao,
            dreTotal: dreRow.total,
            planTotal: plan.total,
            delta,
            deltaPct,
            monthDiffs,
        });
    });
    compareRows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const byCoordinator = new Map();
    planningAccounts.forEach((acc) => {
        const k = acc.owner.name;
        const item = byCoordinator.get(k) ?? { accounts: 0, total: 0 };
        item.accounts += 1;
        item.total += acc.values.reduce((s, v) => s + Number(v.value), 0);
        byCoordinator.set(k, item);
    });
    console.log(JSON.stringify({
        budgetId: budget2026.id,
        planningAccounts2026: planningAccounts.length,
        planningBaseCodes: planningAggByCode.size,
        dreCodes: dreByCode.size,
        matchedCodes: matched,
        exactMatches: exact,
        codesWithDiff: withDiff,
        codesMissingInDre: missingInDre,
        missingCodeAccounts: missingCodeAccounts.length,
        coordinators: Array.from(byCoordinator.entries()).map(([name, v]) => ({ name, accounts: v.accounts, total: v.total })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        topDiffs: compareRows.slice(0, 25),
    }, null, 2));
    await prismaService.$disconnect();
    await prisma.$disconnect();
})();
//# sourceMappingURL=cross-dre-planning-2026.js.map