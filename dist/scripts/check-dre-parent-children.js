"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
async function run() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const years = [2024, 2025, 2026];
    for (const year of years) {
        const budget = await prisma.budget.findFirst({
            where: { year, kind: 'BUDGET' },
            orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        });
        if (!budget) {
            console.log(`\n[${year}] sem budget BUDGET`);
            continue;
        }
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const childrenByParent = new Map();
        rows.forEach((r) => {
            const p = r.parentId ?? null;
            if (!p)
                return;
            const list = childrenByParent.get(p) ?? [];
            list.push(r);
            childrenByParent.set(p, list);
        });
        const diffs = [];
        for (const row of rows) {
            const kids = childrenByParent.get(row.id) ?? [];
            if (!kids.length)
                continue;
            ['previsto', 'realizado', 'projetado'].forEach((metric) => {
                const parentTotal = Object.values(row.valoresPorMes ?? {}).reduce((acc, m) => acc + Number(m?.[metric] ?? 0), 0);
                const childrenTotal = kids.reduce((acc, k) => acc + Object.values(k.valoresPorMes ?? {}).reduce((a, m) => a + Number(m?.[metric] ?? 0), 0), 0);
                const delta = parentTotal - childrenTotal;
                if (Math.abs(delta) > 0.01) {
                    diffs.push({
                        code: String(row.codigo ?? ''),
                        desc: row.descricao,
                        metric,
                        parent: round2(parentTotal),
                        children: round2(childrenTotal),
                        delta: round2(delta),
                    });
                }
            });
        }
        diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        console.log(`\n[${year}] budget=${budget.name} | rows=${rows.length} | parents=${[...childrenByParent.keys()].length}`);
        console.log(`diferen�as parent vs soma filhos: ${diffs.length}`);
        console.log('top 20:');
        diffs.slice(0, 20).forEach((d, i) => {
            console.log(`${i + 1}. [${d.metric}] ${d.code || '-'} ${d.desc} | parent=${d.parent} | filhos=${d.children} | delta=${d.delta}`);
        });
        const target = diffs.filter((d) => (d.desc || '').toLowerCase().includes('software'));
        if (target.length) {
            console.log('--- software ---');
            target.slice(0, 10).forEach((d) => {
                console.log(`[${d.metric}] ${d.code || '-'} ${d.desc} | parent=${d.parent} | filhos=${d.children} | delta=${d.delta}`);
            });
        }
    }
    await prisma.$disconnect();
}
run().catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=check-dre-parent-children.js.map