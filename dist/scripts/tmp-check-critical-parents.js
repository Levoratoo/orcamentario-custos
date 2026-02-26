"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const targets = [
    '(-) INSUMOS E SERVICOS DE TERCEIROS',
    '90003 - SERVICOS DE TERCEIROS - SERVICOS DE TERCEIROS',
    '(-) OUTROS CUSTOS',
    '6184 - (-) PIS S/DEPRECIACAO',
    '6191 - (-) COFINS S/DEPRECIACOES',
    '(-) SOFTWARES',
    '(-) OUTRAS DESPESAS',
    '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
    '(-) CUSTOS FIXOS',
    '(-) CUSTOS COM PESSOAL',
    '(-) CUSTOS DIRETOS COM PESSOAL',
    '(-) CUSTOS INDIRETOS COM PESSOAL',
];
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        if (!budget)
            throw new Error('Budget 2026 READY not found');
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map((r) => [r.id, r]));
        for (const t of targets) {
            const row = rows.find((r) => norm(String(r.descricao ?? '')).includes(norm(t)));
            if (!row) {
                console.log('MISSING', t);
                continue;
            }
            const parent = row.parentId ? byId.get(row.parentId) : null;
            const children = rows.filter((x) => x.parentId === row.id).length;
            console.log(`${row.descricao} | parent=${parent?.descricao ?? '<ROOT>'} | children=${children}`);
        }
    }
    finally {
        await app.close();
    }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-check-critical-parents.js.map