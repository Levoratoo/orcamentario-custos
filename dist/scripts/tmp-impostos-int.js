"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const client_1 = require("@prisma/client");
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
    const p = new prisma_service_1.PrismaService();
    await p.$connect();
    const s = new dre_service_1.DreService(p);
    const b = await p.budget.findFirst({ where: { year: 2026, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const t = await s.getTree(b.id, 'DRE');
    const rows = t.rows;
    const byId = new Map(rows.map(r => [r.id, r]));
    const parent = rows.find(r => norm(r.descricao).includes('IMPOSTOS SOBRE RECEITAS DE RECEITA SOBRE VENDA MERCADO INTERNO'));
    const jan = '2026-01';
    if (parent) {
        console.log('parent', parent.descricao, Number(parent.valoresPorMes[jan]?.previsto ?? 0));
        rows.filter(r => r.parentId === parent.id).forEach(c => console.log(' -', c.descricao, Number(c.valoresPorMes[jan]?.previsto ?? 0)));
    }
    await p.$disconnect();
})();
//# sourceMappingURL=tmp-impostos-int.js.map