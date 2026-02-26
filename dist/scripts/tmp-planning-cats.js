"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
function resolveCategoryHint(raw) {
    const value = norm(raw);
    if (!value)
        return '';
    const aliases = [
        ['IMPOSTOS/TAXAS/CONTRIBUICOES', 'IMPOSTOS'],
        ['COMUNICACAO E INFORMATICA', 'SOFTWARES'],
        ['VIAGENS E COMERCIAL', 'DESPESAS COM VIAGENS'],
        ['OUTRAS DESPESAS INDIRETAS', 'OUTRAS DESPESAS'],
        ['INSTALACOES E PRESTACAO DE SERVICOS', 'PRESTACAO DE SERVICOS'],
        ['GASTOS COM PESSOAL FOLHA', 'CUSTOS COM PESSOAL'],
        ['GASTOS COM PESSOAL OUTROS', 'DESPESAS COM PESSOAL'],
        ['COPA/COZINHA/MAT.EXPEDIENTE', 'OUTRAS DESPESAS'],
        ['DEPRECIACAO, AMORTIZACAO E EXAUSTAO (ADM)', 'DEPRECIACAO'],
        ['DEPRECIACAO, AMORTIZACAO E EXAUSTAO (FABRICA)', 'DEPRECIACAO'],
        ['DESPESA COM PERDA E CREDITOS DE CLIENTES', 'OUTRAS DESPESAS DIRETAS'],
        ['PENITENCIARIA/TERCEIROS', 'PRESTACAO DE SERVICOS'],
    ];
    const match = aliases.find(([from]) => value.includes(from));
    return match?.[1] ?? raw;
}
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const accounts = await prisma.planningAccount.findMany({
            where: { values: { some: { year: 2026 } } },
            select: { code: true, proacao: { select: { name: true } }, values: { where: { year: 2026, month: 1 }, select: { value: true } }, name: true, label: true }
        });
        const map = new Map();
        for (const a of accounts) {
            const hint = resolveCategoryHint(String(a.proacao?.name ?? '').trim()) || '(SEM_HINT)';
            const sum = a.values.reduce((s, v) => s + Number(v.value), 0);
            map.set(hint, (map.get(hint) ?? 0) + sum);
        }
        const sorted = [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        for (const [k, v] of sorted) {
            if (norm(k).includes('PESSOAL') || Math.abs(v) > 500000) {
                console.log(k, v.toFixed(2));
            }
        }
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-planning-cats.js.map