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
        const candidates = rows.filter(r => {
            const d = String(r.descricao ?? '').trim();
            return /^(6221|6244|6251|6267|6273|6333|6311|189724|193)\b/.test(d);
        });
        console.log('found', candidates.length);
        const month = '2026-01';
        for (const r of candidates.slice(0, 40)) {
            const p = byId.get(r.parentId ?? '');
            const gp = p ? byId.get(p.parentId ?? '') : null;
            const v = Number(r.valoresPorMes?.[month]?.previsto ?? 0);
            console.log(`${r.descricao} | ${v.toFixed(2)} | parent=${p?.descricao ?? 'null'} | grand=${gp?.descricao ?? 'null'}`);
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-find-personnel-details.js.map