"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const realized_baseline_importer_1 = require("../src/dre/realized-baseline.importer");
const prisma = new client_1.PrismaClient();
async function main() {
    const filePath = (0, realized_baseline_importer_1.resolveRealizadoBaselineFile)();
    if (!filePath) {
        throw new Error('Arquivo baseline nao encontrado');
    }
    const summary = await (0, realized_baseline_importer_1.importRealizadoBaseline2026)(prisma, filePath);
    console.log('Import realizado 2026', summary);
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-realizado-baseline.js.map