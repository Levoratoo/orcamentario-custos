"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
(async () => {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const accs = await prisma.planningAccount.findMany({
            where: { code: { startsWith: '6191' }, values: { some: { year: 2026, month: 1 } } },
            select: { code: true, name: true, label: true, proacao: { select: { name: true } }, values: { where: { year: 2026, month: 1 }, select: { value: true } } }
        });
        console.log('accounts', accs.length);
        let sum = 0;
        for (const a of accs) {
            const v = a.values.reduce((s, x) => s + Number(x.value), 0);
            sum += v;
            console.log(a.code, '|', a.proacao?.name ?? '', '|', v.toFixed(2), '|', a.label ?? a.name ?? '');
        }
        console.log('total', sum.toFixed(2));
    }
    finally {
        await app.close();
    }
})();
//# sourceMappingURL=tmp-code-6191.js.map