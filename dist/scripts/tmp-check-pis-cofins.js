"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        if (!budget)
            throw new Error('no');
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const byId = new Map(rows.map(r => [r.id, r]));
        for (const code of ['68713', '68720', '6184', '6191']) {
            const row = rows.find(r => String(r.codigo ?? '').trim() === code || String(r.descricao ?? '').includes(code));
            if (!row) {
                console.log('missing', code);
                continue;
            }
            const parent = row.parentId ? byId.get(row.parentId) : null;
            console.log(code, row.descricao, 'parent=', parent?.descricao ?? '<ROOT>');
        }
    }
    finally {
        await app.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-check-pis-cofins.js.map