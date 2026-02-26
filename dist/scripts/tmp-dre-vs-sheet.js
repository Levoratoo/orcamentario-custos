"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const dre_2026_sheet_1 = require("../src/dre/dre-2026-sheet");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const sheet = (0, dre_2026_sheet_1.getDre2026SheetData)();
        if (!sheet) {
            console.log('no sheet');
            return;
        }
        const labels = [
            '(-) CUSTOS E DESPESAS FIXAS DESEMBOLS�VEIS',
            '(-) CUSTOS FIXOS',
            '(-) CUSTOS COM PESSOAL',
        ];
        for (const label of labels) {
            const r = rows.find(x => norm(x.descricao) === norm(label));
            const s = sheet.entries.find(e => norm(e.label) === norm(label));
            const dreJan = r ? Number(r.valoresPorMes?.['2026-01']?.previsto ?? 0) : NaN;
            const shJan = s ? Number(s.months.get(1)?.previsto ?? 0) : NaN;
            console.log(label);
            console.log('  DRE Jan:', dreJan);
            console.log('  SHE Jan:', shJan);
            console.log('  Delta  :', dreJan - shJan);
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-dre-vs-sheet.js.map