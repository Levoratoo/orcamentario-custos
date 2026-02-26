"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    for (const year of [2024, 2025, 2026]) {
        const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
        if (!budget) {
            console.log({ year, error: 'budget not found' });
            continue;
        }
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map(r => [r.id, r]));
        const childrenByParent = new Map();
        rows.forEach(r => { if (!r.parentId || !byId.has(r.parentId))
            return; const list = childrenByParent.get(r.parentId) ?? []; list.push(r); childrenByParent.set(r.parentId, list); });
        let mismatch = 0;
        for (const [pid, children] of childrenByParent.entries()) {
            const p = byId.get(pid);
            for (const m of tree.months) {
                const pv = Number(p.valoresPorMes[m]?.previsto ?? 0);
                const sv = children.reduce((a, c) => a + Number(c.valoresPorMes[m]?.previsto ?? 0), 0);
                if (Math.abs(pv - sv) > 0.02) {
                    mismatch++;
                    break;
                }
            }
        }
        console.log({ year, rows: rows.length, parentsWithChildren: childrenByParent.size, mismatchParents: mismatch });
    }
    await prisma.$disconnect();
})().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-rollup-all-years.js.map