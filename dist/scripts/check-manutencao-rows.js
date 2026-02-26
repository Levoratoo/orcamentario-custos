"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const tree = await dre.getTree(budget.id, 'DRE');
    const rows = tree.rows;
    const byId = new Map(rows.map(r => [r.id, r]));
    const hits = rows.filter(r => norm(r.descricao).includes('MANUTENCAO DE SOFTWARE')).map(r => ({
        desc: r.descricao,
        level: r.nivel,
        parent: r.parentId ? byId.get(r.parentId)?.descricao ?? null : null,
        children: rows.filter(c => c.parentId === r.id).length,
    }));
    console.log(JSON.stringify(hits, null, 2));
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-manutencao-rows.js.map