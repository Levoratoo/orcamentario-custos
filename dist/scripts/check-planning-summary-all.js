"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dre_service_1 = require("../src/dre/dre.service");
const planning_service_1 = require("../src/planning/planning.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const planning = new planning_service_1.PlanningService(prisma, new dre_service_1.DreService(prisma));
    const sum = (arr) => arr.reduce((acc, value) => acc + Number(value ?? 0), 0);
    for (const year of [2024, 2025, 2026]) {
        const out = await planning.getSummary({ sub: 'admin', role: 'ADMIN' }, 'all', year);
        const series = out.chart.series;
        console.log(JSON.stringify({
            year,
            realAtualTotal: sum(series.realizadoAnoAtual),
            realAntTotal: sum(series.realizadoAnoAnt),
            mayAtual: series.realizadoAnoAtual[4],
            mayAnt: series.realizadoAnoAnt[4],
            mayOrcadoAtual: series.orcadoAnoAtual[4],
            mayOrcadoAnt: series.orcadoAnoAnt[4],
        }, null, 2));
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-planning-summary-all.js.map