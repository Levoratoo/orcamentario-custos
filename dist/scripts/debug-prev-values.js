"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const acc = await dre.getExerciseAccumulated(2025, 1);
    const nonZeroPrev = acc.rows
        .filter((r) => Math.abs(r.previousValue) > 0.001)
        .sort((a, b) => Math.abs(b.previousValue) - Math.abs(a.previousValue))
        .slice(0, 20)
        .map((r) => ({ descricao: r.descricao, nivel: r.nivel, parentId: r.parentId, prev: r.previousValue, curr: r.currentValue }));
    const zeroPrevTop = acc.rows
        .filter((r) => Math.abs(r.previousValue) <= 0.001)
        .slice(0, 20)
        .map((r) => ({ descricao: r.descricao, nivel: r.nivel, parentId: r.parentId, prev: r.previousValue, curr: r.currentValue }));
    console.log('nonZeroPrev sample', nonZeroPrev);
    console.log('zeroPrev sample', zeroPrevTop);
    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=debug-prev-values.js.map