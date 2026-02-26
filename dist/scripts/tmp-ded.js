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
    const ded = rows.find(r => norm(r.descricao).includes('(-) DEDUCOES'));
    console.log('DEDU', ded?.id, ded?.descricao);
    for (const r of rows) {
        const tx = norm(r.descricao);
        if (tx.includes('IMPOSTOS') || tx.includes('PIS') || tx.includes('COFINS') || tx.includes('ISS') || tx.includes('IPI') || tx.includes('ICMS') || tx.includes('DEDUCOES')) {
            const pRow = r.parentId ? byId.get(r.parentId) : null;
            console.log(`${r.id} | n=${r.nivel} | parent=${pRow?.descricao ?? 'ROOT'} | ${r.descricao}`);
        }
    }
    await p.$disconnect();
})();
//# sourceMappingURL=tmp-ded.js.map