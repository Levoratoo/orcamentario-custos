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
require("reflect-metadata");
const xlsx = __importStar(require("xlsx"));
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const clean = (s) => String(s ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
function loadSheet(file) {
    const wb = xlsx.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    return rows.slice(1).map((row, i) => ({ rank: i, label: clean(row[0]), key: norm(clean(row[0]).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')) }));
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
        if (!budget)
            throw new Error('Budget 2026 READY not found');
        const tree = await dre.getTree(budget.id, 'DRE');
        const sys = tree.rows.map((row, i) => ({ rank: i, label: clean(row.descricao), key: norm(clean(row.descricao).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')) }));
        const sh = loadSheet('dre expandida.xlsx');
        let printed = 0;
        const min = Math.min(sys.length, sh.length);
        for (let i = 0; i < min && printed < 120; i += 1) {
            if (sys[i].key !== sh[i].key) {
                console.log(`IDX ${i}:`);
                console.log(`  SHEET ${sh[i].label}`);
                console.log(`  SYS   ${sys[i].label}`);
                printed += 1;
            }
        }
        if (sys.length !== sh.length) {
            console.log('LEN_DIFF', 'sheet=', sh.length, 'sys=', sys.length);
            if (sh.length > sys.length) {
                for (let i = sys.length; i < sh.length; i += 1) {
                    console.log('  EXTRA_SHEET', i, sh[i].label);
                }
            }
        }
    }
    finally {
        await app.close();
    }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-dre-order-diff.js.map