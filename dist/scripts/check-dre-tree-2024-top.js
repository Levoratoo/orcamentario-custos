"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dre_service_1 = require("../src/dre/dre.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const budget = await prisma.budget.findFirst({ where: { year: 2024, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
    if (!budget)
        throw new Error('budget 2024 not found');
    const service = new dre_service_1.DreService(prisma);
    const tree = await service.getTree(budget.id, 'DRE');
    const jan = '2024-01';
    console.log(tree.rows.slice(0, 12).map((r) => ({ desc: r.descricao, nivel: r.nivel, parent: r.parentId, jan: r.valoresPorMes?.[jan] })));
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-dre-tree-2024-top.js.map