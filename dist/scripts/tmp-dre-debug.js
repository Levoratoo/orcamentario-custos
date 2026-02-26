"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const client_1 = require("@prisma/client");
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    for (const year of [2024, 2025, 2026]) {
        const budget = await prisma.budget.findFirst({ where: { year, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
        if (!budget)
            continue;
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map((r) => [r.id, r]));
        const jan = `${year}-01`;
        const find = (name) => rows.find((r) => norm(r.descricao).includes(norm(name)));
        const ded = find('DEDUCOES');
        const ins = find('INSUMOS E SERVICOS DE TERCEIROS');
        const out = find('OUTROS CUSTOS');
        const imp = find('(-) IMPOSTOS');
        const fin = find('DESPESAS FINANCEIRAS');
        console.log(`\n=== ${year} ===`);
        for (const r of [ded, imp, ins, out, fin].filter(Boolean)) {
            const children = rows.filter((x) => x.parentId === r.id);
            const v = Number(r.valoresPorMes?.[jan]?.previsto ?? 0).toFixed(2);
            console.log(`${r.descricao} | jan=${v} | children=${children.length}`);
            children.slice(0, 12).forEach((c) => {
                console.log(`  - ${c.descricao} | ${Number(c.valoresPorMes?.[jan]?.previsto ?? 0).toFixed(2)}`);
            });
            if (children.length > 12)
                console.log(`  ... +${children.length - 12}`);
        }
        const row90003 = rows.find((r) => norm(r.descricao).includes(norm('90003')) && norm(r.descricao).includes(norm('SERVICOS DE TERCEIROS')));
        if (row90003) {
            const parent = row90003.parentId ? byId.get(row90003.parentId) : null;
            console.log(`90003 row parent => ${parent?.descricao ?? '<none>'} | jan=${Number(row90003.valoresPorMes?.[jan]?.previsto ?? 0).toFixed(2)}`);
        }
        else {
            console.log('90003 row not found');
        }
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=tmp-dre-debug.js.map