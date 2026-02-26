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
    for (const year of [2024, 2025, 2026]) {
        const b = await p.budget.findFirst({ where: { year, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
        if (!b)
            continue;
        const t = await s.getTree(b.id, 'DRE');
        const rows = t.rows;
        const byId = new Map(rows.map(r => [r.id, r]));
        const hits = rows.filter(r => {
            const text = norm(r.descricao);
            return text.includes('90003') || (text.includes('SERVICOS DE TERCEIROS') && String(r.codigo ?? '').trim() === '90003');
        });
        console.log(`\nYEAR ${year} | 90003 rows: ${hits.length}`);
        for (const r of hits) {
            const parent = r.parentId ? byId.get(r.parentId) : null;
            console.log(`- id=${r.id} cod=${r.codigo ?? ''} parent=${parent?.descricao ?? 'ROOT'} desc=${r.descricao}`);
        }
    }
    await p.$disconnect();
})();
//# sourceMappingURL=tmp-90003-scan.js.map