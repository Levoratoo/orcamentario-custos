"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const b = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    const t = await dre.getTree(b.id, 'DRE');
    const rows = t.rows;
    const matches = rows.filter(r => norm(String(r.id)).includes('CONTRIBUICAO SOCIAL')).slice(0, 5);
    console.log(matches.map(r => ({ id: r.id, desc: r.descricao, parentId: r.parentId, nivel: r.nivel })));
    const p = rows.find(r => norm(String(r.id)) === norm('(-) CONTRIBUI��O SOCIAL-266'));
    console.log('exact-norm', p?.id, p?.descricao);
    const sampleParent = rows.find(r => String(r.id).includes('planning-2026:9722.metricssup'))?.parentId;
    console.log('sampleParent', sampleParent);
    await prisma.$disconnect();
})().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=check-parent-id-unicode.js.map