"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
async function run() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    for (const year of [2024, 2025, 2026]) {
        const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
        if (!budget)
            continue;
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const sw = rows.find(r => (r.descricao || '').toUpperCase().includes('SOFTWARE'));
        if (!sw) {
            console.log(`\n[${year}] sem SOFTWARES`);
            continue;
        }
        const children = rows.filter(r => r.parentId === sw.id);
        const months = Object.keys(sw.valoresPorMes).sort();
        console.log(`\n[${year}] ${sw.descricao} children=${children.length}`);
        for (const m of months.slice(0, 4)) {
            const p = sw.valoresPorMes[m] ?? { previsto: 0, realizado: 0, projetado: 0 };
            const c = children.reduce((acc, row) => {
                const v = row.valoresPorMes[m] ?? { previsto: 0, realizado: 0, projetado: 0 };
                acc.previsto += Number(v.previsto || 0);
                acc.realizado += Number(v.realizado || 0);
                acc.projetado += Number(v.projetado || 0);
                return acc;
            }, { previsto: 0, realizado: 0, projetado: 0 });
            console.log(`${m} parent(prev=${p.previsto},real=${p.realizado},proj=${p.projetado}) children(prev=${c.previsto},real=${c.realizado},proj=${c.projetado})`);
        }
    }
    await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-software-months.js.map