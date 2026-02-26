"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const acc = await dre.getExerciseAccumulated(2025, 1);
    const sample = acc.rows.filter((r) => [
        '(+) RECEITA BRUTA',
        '(+) RECEITA SOBRE SERVI�OS',
        '(+) RECEITA SOBRE VENDA MERCADO INTERNO',
    ].includes(r.descricao)).map((r) => ({ descricao: r.descricao, atual: r.currentValue, anterior: r.previousValue }));
    console.log({ compareYear: acc.compareYear, totals: acc.totals, sample });
    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-acc-2025.js.map