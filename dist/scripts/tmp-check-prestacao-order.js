"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const dre_service_1 = require("../src/dre/dre.service");
const collapsed_structure_1 = require("../frontend/src/services/dre/collapsed-structure");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const dre = app.get(dre_service_1.DreService);
        const acc = await dre.getExerciseAccumulated(2026, 1);
        const collapsed = (0, collapsed_structure_1.getCollapsedRootRows)(acc.rows);
        const labels = collapsed.map((r) => r.descricao);
        const norm = labels.map((v) => (0, collapsed_structure_1.normalizeDreLabel)(v));
        const prest = norm
            .map((v, i) => ({ v, i }))
            .filter((x) => x.v === '(-) PRESTACAO DE SERVICOS')
            .map((x) => x.i);
        const sw = norm.findIndex((v) => v === '(-) SOFTWARES');
        console.log('collapsedCount', labels.length);
        console.log('prestacaoIdx', prest.join(','));
        console.log('softwaresIdx', sw);
        for (let i = Math.max(0, sw - 3); i <= Math.min(labels.length - 1, sw + 5); i += 1) {
            console.log(i, labels[i]);
        }
    }
    finally {
        await app.close();
    }
}
main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=tmp-check-prestacao-order.js.map