"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const b = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const t = await dre.getTree(b.id, 'DRE');
    const rows = t.rows;
    const c = rows.filter(r => String(r.codigo ?? '').trim() === '9722');
    console.log(c.map(r => ({ id: r.id, desc: r.descricao, nivel: r.nivel, parentId: r.parentId, sort: r.sortOrder })));
    await prisma.$disconnect();
})().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-code-9722.js.map