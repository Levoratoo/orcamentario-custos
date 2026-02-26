"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const targets = ['(+) RECEITA BRUTA', '(=) RECEITA LIQUIDA', '(-) CUSTOS E DESPESAS VARIAVEIS', '(-) DESPESAS VARIAVEIS', '(=) RESULTADO FINANCEIRO', '(-) DESPESAS FINANCEIRAS', '(+) RECEITAS FINANCEIRAS', '(=) RESULTADO NAO OPERACIONAL', '(=) LUCRO ANTES DO IRPJ E CSLL', '(-) IRPJ E CSLL'];
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        if (!budget)
            throw new Error('no budget');
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        for (const t of targets) {
            const row = rows.find(r => norm(r.descricao) === norm(t));
            if (!row) {
                console.log('MISSING', t);
                continue;
            }
            const children = rows.filter(x => x.parentId === row.id);
            console.log('\n', row.descricao, 'children=', children.length);
            children.slice(0, 20).forEach(c => console.log('  -', c.descricao));
        }
    }
    finally {
        await app.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-show-children.js.map