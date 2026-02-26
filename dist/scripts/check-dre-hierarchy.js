"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const client_1 = require("@prisma/client");
function norm(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dre = new dre_service_1.DreService(prisma);
    const years = [2025, 2026];
    for (const year of years) {
        const budget = await prisma.budget.findFirst({
            where: { year, kind: client_1.BudgetKind.BUDGET, status: client_1.BudgetStatus.READY },
            orderBy: { updatedAt: 'desc' },
        });
        if (!budget) {
            console.log(`[${year}] budget READY nao encontrado`);
            continue;
        }
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const idSet = new Set(rows.map((r) => r.id));
        const roots = rows.filter((r) => !r.parentId);
        const missingParents = rows.filter((r) => r.parentId && !idSet.has(r.parentId));
        const childrenByParent = new Map();
        rows.forEach((r) => {
            if (!r.parentId)
                return;
            childrenByParent.set(r.parentId, (childrenByParent.get(r.parentId) ?? 0) + 1);
        });
        const marker = (label) => /^\s*\(([+\-=])\)\s*/.test(label);
        const markerParents = rows.filter((r) => marker(r.descricao) && (childrenByParent.get(r.id) ?? 0) > 0).length;
        const nonMarkerParents = rows.filter((r) => !marker(r.descricao) && (childrenByParent.get(r.id) ?? 0) > 0).length;
        const suspicious = rows
            .filter((r) => !marker(r.descricao) && (childrenByParent.get(r.id) ?? 0) > 0 && r.nivel > 0)
            .slice(0, 10)
            .map((r) => ({ descricao: r.descricao, nivel: r.nivel, filhos: childrenByParent.get(r.id) ?? 0 }));
        console.log(`\n[${year}] budget=${budget.name} rows=${rows.length}`);
        console.log(`roots=${roots.length} missingParents=${missingParents.length}`);
        console.log(`markerParents=${markerParents} nonMarkerParents=${nonMarkerParents}`);
        const wantedParents = [
            '(+) RECEITA SOBRE VENDA MERCADO INTERNO',
            '(+) RECEITA SOBRE VENDA MERCADO EXTERNO',
            '(-) DEDUCOES',
            '(-) CUSTOS E DESPESAS VARIAVEIS',
            '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
        ];
        for (const label of wantedParents) {
            const found = rows.find((r) => norm(r.descricao).includes(label));
            if (!found) {
                console.log(`  [warn] nao encontrou grupo: ${label}`);
                continue;
            }
            const filhos = childrenByParent.get(found.id) ?? 0;
            console.log(`  ${found.descricao} -> filhos=${filhos} nivel=${found.nivel}`);
        }
        if (suspicious.length > 0) {
            console.log('  [suspeitos] pais sem marcador em nivel > 0:');
            suspicious.forEach((s) => console.log(`    - ${s.descricao} (nivel=${s.nivel}, filhos=${s.filhos})`));
        }
    }
    await prisma.$disconnect();
}
main().catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=check-dre-hierarchy.js.map