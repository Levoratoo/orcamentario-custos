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
        const month = '2026-01';
        const target = rows.find(r => norm(r.descricao) === '(-) CUSTOS COM PESSOAL');
        if (!target) {
            console.log('no target');
            return;
        }
        console.log('target', target.id, target.descricao, 'parent', target.parentId, 'val', Number(target.valoresPorMes[month]?.previsto ?? 0));
        const getChildren = (id) => rows.filter(r => r.parentId === id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const level1 = getChildren(target.id);
        console.log('children', level1.length);
        for (const c of level1) {
            console.log(' -', c.id, c.descricao, 'val', Number(c.valoresPorMes[month]?.previsto ?? 0));
            const level2 = getChildren(c.id);
            for (const d of level2) {
                console.log('    *', d.id, d.descricao, 'val', Number(d.valoresPorMes[month]?.previsto ?? 0));
            }
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-custos-com-pessoal-tree.js.map