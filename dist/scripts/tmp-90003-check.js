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
    const prisma = app.get(prisma_service_1.PrismaService);
    const dre = app.get(dre_service_1.DreService);
    try {
        for (const year of [2024, 2025, 2026]) {
            const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
            if (!budget) {
                console.log('no budget', year);
                continue;
            }
            const tree = await dre.getTree(budget.id, 'DRE');
            const rows = tree.rows;
            const byId = new Map(rows.map(r => [r.id, r]));
            const hits = rows.filter(r => String(r.codigo ?? '').trim() === '90003' || norm(r.descricao).includes('90003') || (norm(r.descricao).includes('SERVICOS DE TERCEIROS') && norm(r.descricao).includes('90003')));
            console.log('\nYEAR', year, 'hits', hits.length);
            for (const h of hits) {
                const p = byId.get(h.parentId ?? '');
                console.log(' ', h.descricao, '| parent=', p?.descricao ?? 'null', '| id=', h.id, '| parentId=', h.parentId ?? 'null');
            }
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-90003-check.js.map