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
        const codes = new Set(['6221', '6244', '6251', '6267', '6273', '6333', '6311', '189724', '193', '9722']);
        const month = '2026-01';
        const filtered = rows.filter(r => codes.has(String(r.codigo ?? '').trim()));
        console.log('count', filtered.length);
        for (const r of filtered.slice(0, 100)) {
            const v = Number(r.valoresPorMes?.[month]?.previsto ?? 0);
            console.log(`${String(r.codigo)} | ${r.descricao} | ${v.toFixed(2)} | parent=${r.parentId ?? 'null'} | id=${r.id}`);
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-find-codes.js.map