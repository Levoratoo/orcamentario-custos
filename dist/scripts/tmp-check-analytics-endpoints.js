"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const dre_service_1 = require("../src/dre/dre.service");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const dre = app.get(dre_service_1.DreService);
        const acc = await dre.getExerciseAccumulated(2026, 12);
        const mon = await dre.getExerciseMonthly(2026, 2);
        console.log('[ANALYTICS] acumulado rows=', acc.rows.length, 'totals.current=', acc.totals.currentValue.toFixed(2));
        console.log('[ANALYTICS] mensal rows=', mon.rows.length, 'totals.current=', mon.totals.currentValue.toFixed(2));
    }
    finally {
        await app.close();
    }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-check-analytics-endpoints.js.map