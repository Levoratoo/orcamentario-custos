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
    const ps = rows.filter(r => norm(r.descricao) === '(-) PRESTACAO DE SERVICOS');
    for (const pr of ps) {
        console.log(`P ${pr.id} sort=${pr.sortOrder} lvl=${pr.nivel} parent=${pr.parentId ?? 'ROOT'}`);
        rows.filter(r => r.parentId === pr.id).forEach(c => console.log(`  - ${c.id} | ${c.descricao}`));
    }
    const sw = rows.find(r => norm(r.descricao) === '(-) SOFTWARES');
    if (sw)
        console.log('SW', sw.id, 'sort', sw.sortOrder, 'lvl', sw.nivel, 'parent', sw.parentId ? byId.get(sw.parentId)?.descricao : 'ROOT');
    await p.$disconnect();
})();
//# sourceMappingURL=tmp-prest.js.map