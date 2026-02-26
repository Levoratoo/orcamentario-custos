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
            throw new Error('no budget');
        const tree = await dre.getTree(budget.id, 'DRE');
        const rows = tree.rows;
        const roots = rows.filter(r => !r.parentId);
        for (const r of roots) {
            const children = rows.filter(x => x.parentId === r.id).length;
            console.log(`${r.descricao} | children=${children}`);
        }
    }
    finally {
        await app.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-roots-2026.js.map