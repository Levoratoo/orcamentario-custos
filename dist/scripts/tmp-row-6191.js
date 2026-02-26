"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const row = rows.find(r => String(r.codigo ?? '').trim() === '6191');
        if (!row) {
            console.log('row not found');
            return;
        }
        const month = '2026-01';
        console.log('row', row.descricao, 'id', row.id, 'parent', row.parentId, 'val', Number(row.valoresPorMes?.[month]?.previsto ?? 0));
        const children = rows.filter(r => r.parentId === row.id);
        console.log('children', children.length);
        for (const c of children) {
            console.log(' -', c.codigo, c.descricao, Number(c.valoresPorMes?.[month]?.previsto ?? 0));
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-row-6191.js.map