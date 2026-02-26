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
const clean = (s) => String(s ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const num = (v) => Number(v ?? 0) || 0;
function loadSheet(file) {
    const wb = xlsx.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    return rows.slice(1).map((row, rank) => {
        const byMonth = {};
        for (let m = 1; m <= 12; m += 1) {
            const prevCol = (m - 1) * 2 + 1;
            const realCol = (m - 1) * 2 + 2;
            byMonth[m] = { previsto: num(row[prevCol]), realizado: num(row[realCol]) };
        }
        return { rank, label: clean(row[0]), key: norm(clean(row[0]).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')), byMonth };
    });
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
        const sys = tree.rows.map((row, rank) => {
            const byMonth = {};
            for (let m = 1; m <= 12; m += 1) {
                const key = `2026-${String(m).padStart(2, '0')}`;
                byMonth[m] = {
                    previsto: num(row.valoresPorMes?.[key]?.previsto),
                    realizado: num(row.valoresPorMes?.[key]?.realizado),
                };
            }
            return { rank, label: clean(row.descricao), key: norm(clean(row.descricao).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')), byMonth };
        });
        const sheet = loadSheet('dre expandida.xlsx');
        const issues = [];
        if (sys.length !== sheet.length) {
            issues.push(`COUNT sheet=${sheet.length} sys=${sys.length}`);
        }
        const min = Math.min(sys.length, sheet.length);
        for (let i = 0; i < min; i += 1) {
            if (sys[i].key !== sheet[i].key) {
                issues.push(`ORDER idx=${i} sheet='${sheet[i].label}' sys='${sys[i].label}'`);
                continue;
            }
            for (let m = 1; m <= 12; m += 1) {
                const s = sheet[i].byMonth[m];
                const r = sys[i].byMonth[m];
                const dp = r.previsto - s.previsto;
                const dr = r.realizado - s.realizado;
                if (Math.abs(dp) > 0.01)
                    issues.push(`VAL_PREV idx=${i} m=${m} label='${sheet[i].label}' delta=${dp.toFixed(2)}`);
                if (Math.abs(dr) > 0.01)
                    issues.push(`VAL_REAL idx=${i} m=${m} label='${sheet[i].label}' delta=${dr.toFixed(2)}`);
            }
        }
        if (issues.length === 0) {
            console.log('OK: ordem e valores (previsto/realizado) 2026 batem 100% com dre expandida.xlsx');
        }
        else {
            console.log('ISSUES', issues.length);
            issues.slice(0, 200).forEach((i) => console.log(i));
        }
    }
    finally {
        await app.close();
    }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
//# sourceMappingURL=tmp-verify-dre-expandida-full.js.map