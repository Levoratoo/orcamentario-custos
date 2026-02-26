"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map(r => [r.id, r]));
        const children = (id) => rows.filter(r => r.parentId === id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const oc = rows.find(r => norm(r.descricao) === '(-) OUTROS CUSTOS');
        if (!oc) {
            console.log('not found');
            return;
        }
        const month = '2026-01';
        for (const c of children(oc.id)) {
            const cv = Number(c.valoresPorMes?.[month]?.previsto ?? 0);
            console.log('-', c.codigo, c.descricao, '|', cv.toFixed(2));
            for (const d of children(c.id)) {
                const dv = Number(d.valoresPorMes?.[month]?.previsto ?? 0);
                console.log('   *', d.codigo, d.descricao, '|', dv.toFixed(2));
            }
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-outros-tree.js.map