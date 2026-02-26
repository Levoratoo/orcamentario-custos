"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const TARGETS = [
    '(+) RECEITA BRUTA',
    '(+) RECEITA SOBRE SERVICOS',
    '(+) RECEITA SOBRE VENDA MERCADO INTERNO',
    '(-) DEDUCOES',
    '(-) CUSTOS E DESPESAS VARIAVEIS',
    '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
    '(-) SOFTWARES',
    'MANUTENCAO DE SOFTWARE',
    '(=) EBITDA',
    '(=) LUCRO LIQUIDO',
];
const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
const num = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
};
function findTarget(rows, target) {
    const key = normalize(target);
    return rows.find((row) => normalize(row.descricao).includes(key)) ?? null;
}
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const years = [2024, 2025, 2026];
    const report = [];
    for (const year of years) {
        const budget = await prisma.budget.findFirst({
            where: { year, kind: 'BUDGET' },
            orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        });
        if (!budget) {
            report.push({ year, error: 'BUDGET_NOT_FOUND' });
            continue;
        }
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map((row) => [row.id, row]));
        const checks = TARGETS.map((target) => {
            const row = findTarget(rows, target);
            if (!row) {
                return { target, found: false };
            }
            const children = rows.filter((item) => item.parentId === row.id);
            const jan = `${year}-01`;
            const janPrev = num(row.valoresPorMes?.[jan]?.previsto);
            const janReal = num(row.valoresPorMes?.[jan]?.realizado);
            const janProj = num(row.valoresPorMes?.[jan]?.projetado);
            const totalPrev = tree.months.reduce((acc, m) => acc + num(row.valoresPorMes?.[m]?.previsto), 0);
            let parentMatchesChildren = null;
            if (children.length > 0) {
                parentMatchesChildren = tree.months.every((m) => {
                    const parentPrev = num(row.valoresPorMes?.[m]?.previsto);
                    const sumChildrenPrev = children.reduce((acc, child) => acc + num(child.valoresPorMes?.[m]?.previsto), 0);
                    return Math.abs(parentPrev - sumChildrenPrev) <= 0.02;
                });
            }
            const parent = row.parentId ? byId.get(row.parentId) : null;
            return {
                target,
                found: true,
                row: row.descricao,
                parent: parent?.descricao ?? null,
                children: children.length,
                janPrev,
                janReal,
                janProj,
                totalPrev,
                parentMatchesChildren,
            };
        });
        report.push({
            year,
            rows: rows.length,
            months: tree.months.length,
            checks,
        });
    }
    console.log(JSON.stringify(report, null, 2));
    await prisma.$disconnect();
})().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=audit-dre-critical.js.map