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
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const BscExcelImportService_1 = require("../src/modules/bsc/import/BscExcelImportService");
function loadLocalEnv() {
    const envFile = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envFile))
        return;
    const lines = fs.readFileSync(envFile, 'utf-8').split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const idx = line.indexOf('=');
        if (idx <= 0)
            continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!process.env[key])
            process.env[key] = value;
    }
}
function extractYear(fileName) {
    const matches = fileName.match(/20\d{2}/g);
    if (!matches || matches.length === 0)
        return 0;
    return Number(matches[matches.length - 1]) || 0;
}
function collectFiles() {
    const configuredPath = process.env.BSC_IMPORT_LOCAL_PATH;
    const defaultDir = process.env.BSC_IMPORT_LOCAL_DIR ?? './_local_files/bsc';
    const absoluteDir = path.isAbsolute(defaultDir) ? defaultDir : path.join(process.cwd(), defaultDir);
    const paths = new Set();
    if (fs.existsSync(absoluteDir)) {
        for (const fileName of fs.readdirSync(absoluteDir)) {
            if (!fileName.toLowerCase().endsWith('.xlsx'))
                continue;
            if (!/mapa\s*estrategico/i.test(fileName))
                continue;
            paths.add(path.join(absoluteDir, fileName));
        }
    }
    if (configuredPath) {
        const absoluteConfigured = path.isAbsolute(configuredPath)
            ? configuredPath
            : path.join(process.cwd(), configuredPath);
        if (fs.existsSync(absoluteConfigured)) {
            paths.add(absoluteConfigured);
        }
    }
    return Array.from(paths).sort((a, b) => extractYear(path.basename(a)) - extractYear(path.basename(b)));
}
async function main() {
    loadLocalEnv();
    const files = collectFiles();
    if (files.length === 0) {
        console.error('Nenhuma planilha BSC encontrada em ./_local_files/bsc');
        process.exitCode = 1;
        return;
    }
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    const prisma = app.get(prisma_service_1.PrismaService);
    const service = app.get(BscExcelImportService_1.BscExcelImportService);
    try {
        const admin = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        console.info('=== BSC IMPORT LOCAL ===');
        for (const filePath of files) {
            const buffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const result = await service.import(buffer, fileName, admin?.id ?? null, { force: true });
            const importJob = await prisma.bscImport.findUnique({ where: { id: result.importId } });
            const warnings = Array.isArray(importJob?.warnings) ? importJob?.warnings : [];
            console.info(`arquivo=${fileName}`);
            console.info(`status=${result.status} importId=${result.importId}`);
            console.info('counters:', result.counters);
            console.info(`warnings=${warnings.length}`);
            warnings.slice(0, 10).forEach((warning, index) => {
                console.info(`  ${index + 1}. [${warning.sheetName ?? '?'}:${warning.rowIndex ?? '?'}] ${warning.message ?? ''}`);
            });
        }
    }
    catch (error) {
        console.error(error?.message ?? error);
        process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
main();
//# sourceMappingURL=bsc-import-local.js.map