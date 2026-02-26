"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
function n(v) {
    return Number(v ?? 0);
}
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({
            where: { year: 2026, kind: 'BUDGET', status: 'READY' },
            orderBy: { updatedAt: 'desc' },
        });
        if (!budget)
            throw new Error('budget 2026 not found');
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const month = `${tree.year}-01`;
        const targets = [
            '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
            '(-) CUSTOS FIXOS',
            '(-) CUSTOS COM PESSOAL',
            'CUSTOS COM PESSOAL DIRETO E INDIRETO',
            '(-) CUSTOS COM PESSOAL DIRETO E INDIRETO',
        ];
        const norm = (s) => String(s ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
        const map = new Map(rows.map((r) => [r.id, r]));
        const children = new Map();
        for (const r of rows) {
            if (!r.parentId)
                continue;
            const list = children.get(r.parentId) ?? [];
            list.push(r);
            children.set(r.parentId, list);
        }
        for (const target of targets) {
            const row = rows.find((r) => norm(r.descricao) === norm(target));
            if (!row) {
                console.log('\n--- not found', target);
                continue;
            }
            const val = n(row.valoresPorMes?.[month]?.previsto);
            console.log(`\n=== ${row.descricao} [id=${row.id}] previsto(${month})=${val.toFixed(2)} parent=${row.parentId ?? 'null'}`);
            const childs = (children.get(row.id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            let sum = 0;
            for (const c of childs) {
                const cv = n(c.valoresPorMes?.[month]?.previsto);
                sum += cv;
                console.log(`  - ${c.descricao} [${c.id}] = ${cv.toFixed(2)}`);
            }
            console.log(`  children sum: ${sum.toFixed(2)}  delta(parent-sum): ${(val - sum).toFixed(2)}`);
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-dre-check.js.map