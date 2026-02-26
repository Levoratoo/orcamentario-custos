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
        const month = '2026-01';
        for (const r of rows) {
            const t = norm(r.descricao);
            if (t.includes('CUSTOS DIRETOS COM PESSOAL') || t.includes('CUSTOS INDIRETOS COM PESSOAL') || t.includes('DESPESAS COM PESSOAL - SALARIOS')) {
                console.log(r.descricao, '| nivel', r.nivel, '| parent', r.parentId ?? 'null', '| val', Number(r.valoresPorMes?.[month]?.previsto ?? 0));
            }
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-find-personnel-parents.js.map