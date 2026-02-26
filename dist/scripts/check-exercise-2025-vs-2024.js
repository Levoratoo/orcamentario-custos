"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const acc = await dre.getExerciseAccumulated(2025, 1);
    const mon = await dre.getExerciseMonthly(2025, 1);
    console.log('ACC', { year: acc.year, compareYear: acc.compareYear, rows: acc.rows.length, current: acc.totals.currentValue, prev: acc.totals.previousValue });
    console.log('MON', { year: mon.year, compareYear: mon.compareYear, rows: mon.rows.length, current: mon.totals.currentValue, prev: mon.totals.previousValue });
    const budgets = await prisma.budget.findMany({ where: { kind: 'BUDGET', status: 'READY' }, orderBy: { year: 'desc' }, select: { year: true, name: true } });
    console.log('YEARS_READY', budgets.map((b) => `${b.year}:${b.name}`).join(' | '));
    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-exercise-2025-vs-2024.js.map