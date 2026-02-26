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
    const fev = '2024-02';
    const target = tree.rows.find((r) => String(r.descricao).includes('RECEITA BRUTA'));
    const serv = tree.rows.find((r) => String(r.descricao).includes('RECEITA SOBRE SERVI�OS'));
    console.log('closingMonth', tree.closingMonth);
    console.log('receita bruta', target?.valoresPorMes?.[jan], target?.valoresPorMes?.[fev]);
    console.log('receita servicos', serv?.valoresPorMes?.[jan], serv?.valoresPorMes?.[fev]);
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-dre-tree-2024.js.map