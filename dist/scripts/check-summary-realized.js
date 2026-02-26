"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const planning_service_1 = require("../src/planning/planning.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const planning = new planning_service_1.PlanningService(prisma, dre);
    const proacao = await prisma.proacao.findFirst({ orderBy: { name: 'asc' } });
    if (!proacao) {
        console.log('no proacao');
        await prisma.$disconnect();
        return;
    }
    const out = await planning.getSummary({ sub: 'admin', role: 'ADMIN' }, proacao.id, 2026);
    const realizedCurrentTotal = out.chart.series.realizadoAnoAtual.reduce((a, b) => a + (b ?? 0), 0);
    const realizedPrevTotal = out.chart.series.realizadoAnoAnt.reduce((a, b) => a + (b ?? 0), 0);
    console.log({ proacao: proacao.name, realizedCurrentTotal, realizedPrevTotal, janCurrent: out.chart.series.realizadoAnoAtual[0], janPrev: out.chart.series.realizadoAnoAnt[0] });
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-summary-realized.js.map