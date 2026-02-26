"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const acc = await dre.getExerciseAccumulated(2026, 1);
        const mon = await dre.getExerciseMonthly(2026, 1);
        for (const [name, data] of [['acc', acc], ['mon', mon]]) {
            const rows = data.rows;
            const byId = new Map(rows.map(r => [String(r.id), r]));
            const rb = rows.find(r => norm(r.descricao) === '(+) RECEITA BRUTA');
            console.log('\n', name, 'rows', rows.length, 'hasRB', !!rb);
            if (!rb)
                continue;
            const children = rows.filter(r => String(r.parentId ?? '') === String(rb.id));
            console.log('RB id', rb.id, 'children', children.length);
            children.slice(0, 20).forEach(c => console.log('  -', c.descricao, 'id', c.id));
            const top = rows.filter(r => !r.parentId).slice(0, 20);
            console.log('roots sample');
            top.forEach(r => console.log(' *', r.descricao, 'id', r.id));
        }
    }
    finally {
        await app.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-check-exercise-rb.js.map