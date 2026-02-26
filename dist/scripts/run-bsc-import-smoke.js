"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const prisma_service_1 = require("../src/prisma/prisma.service");
const bsc_import_service_1 = require("../src/bsc/bsc-import.service");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const service = new bsc_import_service_1.BscImportService(prisma);
    const cwd = process.cwd();
    const fileName = fs
        .readdirSync(cwd)
        .find((name) => name.toLowerCase().includes('mapa estrategico 2025') && name.toLowerCase().endsWith('.xlsx'));
    if (!fileName) {
        console.log('FILE_NOT_FOUND');
        await prisma.$disconnect();
        return;
    }
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
    });
    const buffer = fs.readFileSync(path.join(cwd, fileName));
    const result = await service.importExcel({ originalname: fileName, buffer }, admin?.id);
    const counters = {
        perspectives: await prisma.bscPerspective.count(),
        objectives: await prisma.bscObjective.count(),
        indicators: await prisma.bscIndicator.count(),
        projects: await prisma.bscProject.count(),
        tasks: await prisma.bscProjectTask.count(),
        snapshots: await prisma.bscTaskSnapshot.count(),
    };
    console.log(JSON.stringify({ result, counters }, null, 2));
    await prisma.$disconnect();
}
main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=run-bsc-import-smoke.js.map