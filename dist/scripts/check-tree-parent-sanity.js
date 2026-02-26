"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const b = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const tree = await dre.getTree(b.id, 'DRE');
    const rows = tree.rows;
    const byId = new Map(rows.map(r => [r.id, r]));
    const target = rows.find(r => r.descricao.includes('RECEITA SOBRE VENDA MERCADO INTERNO'));
    if (target) {
        const parent = target.parentId ? byId.get(target.parentId) : null;
        console.log({ target: target.descricao, level: target.nivel, parent: parent?.descricao ?? null, parentLevel: parent?.nivel ?? null });
    }
    const software = rows.find(r => r.descricao === 'Manuten��o de Software');
    if (software) {
        const parent = software.parentId ? byId.get(software.parentId) : null;
        console.log({ softwareParent: parent?.descricao, softwareChildren: rows.filter(r => r.parentId === software.id).length });
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-tree-parent-sanity.js.map