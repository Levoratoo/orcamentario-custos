"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
async function run() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    for (const year of [2024, 2025, 2026]) {
        const budget = await prisma.budget.findFirst({
            where: { year, kind: 'BUDGET' },
            orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        });
        if (!budget)
            continue;
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const childrenByParent = new Map();
        rows.forEach((r) => {
            if (!r.parentId)
                return;
            const list = childrenByParent.get(r.parentId) ?? [];
            list.push(r);
            childrenByParent.set(r.parentId, list);
        });
        const diffs = [];
        for (const row of rows) {
            const kids = childrenByParent.get(row.id) ?? [];
            if (!kids.length)
                continue;
            for (const metric of ['previsto', 'realizado', 'projetado']) {
                const parent = Object.values(row.valoresPorMes ?? {}).reduce((a, m) => a + Number(m?.[metric] ?? 0), 0);
                const child = kids.reduce((a, k) => a + Object.values(k.valoresPorMes ?? {}).reduce((x, m) => x + Number(m?.[metric] ?? 0), 0), 0);
                const delta = parent - child;
                if (Math.abs(delta) > 0.01)
                    diffs.push({ desc: row.descricao, metric, delta: round2(delta) });
            }
        }
        console.log(`[${year}] divergencias=${diffs.length}`);
        if (diffs.length) {
            diffs.slice(0, 10).forEach((d, i) => console.log(`${i + 1}. [${d.metric}] ${d.desc} delta=${d.delta}`));
        }
    }
    await prisma.$disconnect();
}
run().catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=check-dre-rollup-after-fix.js.map