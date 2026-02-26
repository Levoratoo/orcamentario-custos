"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
(async () => {
    const p = await prisma.proacao.findFirst({ where: { name: 'Importado' }, select: { id: true, name: true } });
    if (!p) {
        console.log('NO_IMPORTADO');
        await prisma.$disconnect();
        return;
    }
    const accounts = await prisma.planningAccount.findMany({ where: { proacaoId: p.id }, select: { id: true, code: true, label: true } });
    const ids = accounts.map(a => a.id);
    const agg2026 = await prisma.planningValue.aggregate({ where: { accountId: { in: ids }, year: 2026 }, _sum: { value: true }, _count: { id: true } });
    const agg2025 = await prisma.planningValue.aggregate({ where: { accountId: { in: ids }, year: 2025 }, _sum: { value: true }, _count: { id: true } });
    console.log(JSON.stringify({ accounts: accounts.length, sum2026: Number(agg2026._sum.value ?? 0), cells2026: agg2026._count.id, sum2025: Number(agg2025._sum.value ?? 0), cells2025: agg2025._count.id }, null, 2));
    console.log('SAMPLE');
    for (const a of accounts.slice(0, 20))
        console.log(`${a.code} | ${a.label}`);
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-importado.js.map