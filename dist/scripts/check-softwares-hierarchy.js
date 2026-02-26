"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const noAcc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
async function run() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    if (!budget)
        throw new Error('budget 2026 not found');
    const tree = await dre.getTree(budget.id, 'DRE');
    const rows = tree.rows;
    const softwaresParent = rows.find(r => noAcc(r.descricao).includes('(-) SOFTWARES'));
    if (!softwaresParent) {
        console.log('not found softwares parent');
        console.log(rows.filter(r => noAcc(r.descricao).includes('SOFTWARE')).map(r => r.descricao).slice(0, 20));
        await prisma.$disconnect();
        return;
    }
    const children = rows.filter(r => r.parentId === softwaresParent.id);
    const manut = children.find(r => noAcc(r.descricao).includes('MANUTENCAO DE SOFTWARE'));
    const manutChildren = manut ? rows.filter(r => r.parentId === manut.id) : [];
    const month = '2026-01';
    const val = (r) => Number(r?.valoresPorMes?.[month]?.previsto ?? 0);
    const sumChildren = children.reduce((a, r) => a + val(r), 0);
    const sumManutChildren = manutChildren.reduce((a, r) => a + val(r), 0);
    console.log(JSON.stringify({
        softwaresParent: { descricao: softwaresParent.descricao, janPrev: val(softwaresParent), children: children.length },
        manutencao: manut ? { descricao: manut.descricao, janPrev: val(manut), children: manutChildren.length } : null,
        checks: {
            parentEqualsChildren: Math.abs(val(softwaresParent) - sumChildren) < 0.01,
            manutEqualsChildren: manut ? Math.abs(val(manut) - sumManutChildren) < 0.01 : null,
        },
        firstChildren: children.slice(0, 12).map(r => ({ descricao: r.descricao, janPrev: val(r) })),
        firstManutChildren: manutChildren.slice(0, 12).map(r => ({ descricao: r.descricao, janPrev: val(r) })),
    }, null, 2));
    await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-softwares-hierarchy.js.map