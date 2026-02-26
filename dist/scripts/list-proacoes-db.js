"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
(async () => {
    const all = await prisma.proacao.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { accounts: true, budgetLimits: true } } },
    });
    console.log('DB_PROACOES', all.length);
    for (const item of all) {
        console.log(`${item.id}|${item.name}|accounts=${item._count.accounts}|limits=${item._count.budgetLimits}`);
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=list-proacoes-db.js.map