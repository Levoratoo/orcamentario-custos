"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const tree = await dre.getTree(budget.id, 'DRE');
    const rows = tree.rows;
    const hits = rows.filter(r => String(r.descricao).trim().startsWith('9722'));
    console.log('hits', hits.length);
    console.log(hits.slice(0, 10));
    await prisma.$disconnect();
})().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-9722-rows.js.map