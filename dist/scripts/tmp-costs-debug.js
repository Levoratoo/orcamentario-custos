"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const client_1 = require("@prisma/client");
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const n = (x) => Number(x ?? 0);
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const year = 2026;
    const budget = await prisma.budget.findFirst({ where: { year, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    if (!budget) {
        console.log('budget not found');
        return;
    }
    const tree = await dre.getTree(budget.id, 'DRE');
    const rows = tree.rows;
    const byId = new Map(rows.map(r => [r.id, r]));
    const jan = `${year}-01`;
    const targets = [
        'CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
        'CUSTOS FIXOS',
        'CUSTOS DIRETOS COM PESSOAL',
        'CUSTOS INDIRETOS COM PESSOAL',
        'CUSTOS COM PESSOAL',
    ];
    const matched = rows.filter(r => targets.some(t => norm(r.descricao).includes(t)));
    console.log('--- TARGET ROWS ---');
    for (const r of matched) {
        const children = rows.filter(c => c.parentId === r.id);
        const p = n(r.valoresPorMes?.[jan]?.previsto);
        const s = children.reduce((acc, c) => acc + n(c.valoresPorMes?.[jan]?.previsto), 0);
        const parent = r.parentId ? byId.get(r.parentId) : null;
        console.log(`\n${r.id}`);
        console.log(`desc: ${r.descricao}`);
        console.log(`parent: ${parent?.descricao ?? 'ROOT'}`);
        console.log(`jan parent=${p.toFixed(2)} | jan children=${s.toFixed(2)} | delta=${(p - s).toFixed(2)} | children=${children.length}`);
        children
            .filter(c => Math.abs(n(c.valoresPorMes?.[jan]?.previsto)) > 0.01)
            .sort((a, b) => Math.abs(n(b.valoresPorMes?.[jan]?.previsto)) - Math.abs(n(a.valoresPorMes?.[jan]?.previsto)))
            .slice(0, 20)
            .forEach(c => console.log(`  - ${c.descricao} | ${n(c.valoresPorMes?.[jan]?.previsto).toFixed(2)}`));
    }
    console.log('\n--- POSSIBLE DUPLICATE COST CODES (62xx/63xx) WITH MULTIPLE PARENTS ---');
    const bucket = new Map();
    rows.forEach(r => {
        const code = String(r.codigo ?? '').trim();
        if (!/^6\d+/.test(code))
            return;
        const list = bucket.get(code) ?? [];
        list.push(r);
        bucket.set(code, list);
    });
    [...bucket.entries()].filter(([, list]) => list.length > 1).slice(0, 60).forEach(([code, list]) => {
        console.log(`\ncode ${code}`);
        list.forEach(r => {
            const p = r.parentId ? byId.get(r.parentId) : null;
            console.log(`  - ${r.descricao} | parent=${p?.descricao ?? 'ROOT'} | jan=${n(r.valoresPorMes?.[jan]?.previsto).toFixed(2)}`);
        });
    });
    await prisma.$disconnect();
})();
//# sourceMappingURL=tmp-costs-debug.js.map