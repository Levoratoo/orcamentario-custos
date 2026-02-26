"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const client_1 = require("@prisma/client");
const n = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
    const p = new prisma_service_1.PrismaService();
    await p.$connect();
    const s = new dre_service_1.DreService(p);
    const b = await p.budget.findFirst({ where: { year: 2026, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    if (!b) {
        console.log('no budget');
        return;
    }
    const t = await s.getTree(b.id, 'DRE');
    const rows = t.rows;
    rows.filter(r => n(r.descricao).includes('OUTROS CUSTOS')).forEach(r => console.log(`${r.id} | nivel=${r.nivel} | parent=${r.parentId} | ${r.descricao}`));
    await p.$disconnect();
})();
//# sourceMappingURL=tmp-outros.js.map