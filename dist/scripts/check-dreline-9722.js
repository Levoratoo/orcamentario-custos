"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const b = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const lines = await prisma.dreLine.findMany({ where: { budgetId: b.id, accountCode: '9722' }, select: { nodeKey: true, accountName: true, parentKey: true, level: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } });
    console.log(lines.slice(0, 20));
    console.log('count', lines.length);
    await prisma.$disconnect();
})().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-dreline-9722.js.map