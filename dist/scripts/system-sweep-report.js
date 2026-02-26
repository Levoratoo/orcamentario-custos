"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
function abs(n) { return Math.abs(Number(n || 0)); }
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const years = [2024, 2025, 2026];
    const report = [];
    for (const year of years) {
        const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
        if (!budget) {
            report.push({ year, error: 'budget-not-found' });
            continue;
        }
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const idSet = new Set(rows.map((r) => r.id));
        const duplicateIds = rows.length - idSet.size;
        const missingParents = rows.filter((r) => r.parentId && !idSet.has(r.parentId)).length;
        const childrenByParent = new Map();
        rows.forEach((r) => {
            if (!r.parentId)
                return;
            const list = childrenByParent.get(r.parentId) ?? [];
            list.push(r);
            childrenByParent.set(r.parentId, list);
        });
        let parentChildDiffs = 0;
        for (const row of rows) {
            const children = childrenByParent.get(row.id) ?? [];
            if (!children.length)
                continue;
            for (const metric of ['previsto', 'realizado', 'projetado']) {
                const parentTotal = Object.values(row.valoresPorMes ?? {}).reduce((acc, m) => acc + Number(m?.[metric] ?? 0), 0);
                const childrenTotal = children.reduce((acc, child) => {
                    return acc + Object.values(child.valoresPorMes ?? {}).reduce((a, m) => a + Number(m?.[metric] ?? 0), 0);
                }, 0);
                if (abs(parentTotal - childrenTotal) > 0.01)
                    parentChildDiffs += 1;
            }
        }
        const dreCodes = new Set(rows.map((r) => String(r.codigo ?? '').trim()).filter(Boolean));
        const planning = await prisma.planningAccount.findMany({
            where: { values: { some: { year } } },
            select: { code: true },
        });
        const planningBase = new Map();
        planning.forEach((p) => {
            const base = String(p.code ?? '').trim().split('.')[0]?.trim();
            if (!base)
                return;
            planningBase.set(base, (planningBase.get(base) ?? 0) + 1);
        });
        const missingPlanningBases = [...planningBase.entries()]
            .filter(([base]) => !dreCodes.has(base))
            .sort((a, b) => b[1] - a[1]);
        report.push({
            year,
            budget: budget.name,
            rows: rows.length,
            duplicateIds,
            missingParents,
            parentChildDiffs,
            planningBaseCount: planningBase.size,
            planningBasesMissingInDre: missingPlanningBases.length,
            planningMissingTop20: missingPlanningBases.slice(0, 20).map(([base, count]) => ({ base, count })),
        });
    }
    console.log(JSON.stringify(report, null, 2));
    await prisma.$disconnect();
}
main().catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=system-sweep-report.js.map