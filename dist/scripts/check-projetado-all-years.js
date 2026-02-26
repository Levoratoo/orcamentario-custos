"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dre_service_1 = require("../src/dre/dre.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const service = new dre_service_1.DreService(prisma);
    for (const y of [2024, 2025, 2026]) {
        const budget = await prisma.budget.findFirst({ where: { year: y, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        if (!budget) {
            console.log('no budget', y);
            continue;
        }
        const tree = await service.getTree(budget.id, 'DRE');
        const month = `${y}-01`;
        const first = tree.rows[0];
        const v = first?.valoresPorMes?.[month] ?? { previsto: 0, realizado: 0, projetado: 0 };
        console.log(JSON.stringify({
            year: y,
            row: first?.descricao,
            previsto: v.previsto,
            realizado: v.realizado,
            projetado: v.projetado,
            check: Math.abs((v.previsto + v.realizado) - v.projetado) < 0.0001,
        }));
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-projetado-all-years.js.map