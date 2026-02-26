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
const client_1 = require("@prisma/client");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const planning_service_1 = require("../src/planning/planning.service");
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
        return {
            rank,
            label: clean(row[0]),
            key: norm(clean(row[0]).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')),
            byMonth,
        };
    });
}
function compareTreeToSheet(year, rows, sheet) {
    const issues = [];
    const sys = rows.map((row, rank) => ({
        rank,
        label: clean(row.descricao),
        key: norm(clean(row.descricao).replace(/^\d+(?:\.\d+)*\s*-\s*/u, '')),
        byMonth: Object.fromEntries(Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const key = `${year}-${String(m).padStart(2, '0')}`;
            return [m, {
                    previsto: num(row.valoresPorMes?.[key]?.previsto),
                    realizado: num(row.valoresPorMes?.[key]?.realizado),
                }];
        })),
    }));
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
            const dp = sys[i].byMonth[m].previsto - sheet[i].byMonth[m].previsto;
            const dr = sys[i].byMonth[m].realizado - sheet[i].byMonth[m].realizado;
            if (Math.abs(dp) > 0.01)
                issues.push(`PREV idx=${i} m=${m} delta=${dp.toFixed(2)} label='${sheet[i].label}'`);
            if (Math.abs(dr) > 0.01)
                issues.push(`REAL idx=${i} m=${m} delta=${dr.toFixed(2)} label='${sheet[i].label}'`);
        }
    }
    return issues;
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const planning = app.get(planning_service_1.PlanningService);
        const budget2026 = await prisma.budget.findFirst({
            where: { year: 2026, kind: 'BUDGET', status: 'READY' },
            orderBy: { updatedAt: 'desc' },
        });
        if (!budget2026)
            throw new Error('Budget 2026 READY not found');
        const sheet = loadSheet('dre expandida.xlsx');
        const modes = ['BUDGET', 'DRE', 'PROJECTED', 'ACTUAL'];
        for (const mode of modes) {
            const tree = await dre.getTree(budget2026.id, mode);
            const issues = compareTreeToSheet(2026, tree.rows, sheet);
            console.log(`[MODE ${mode}] issues=${issues.length}`);
            if (issues.length > 0) {
                issues.slice(0, 20).forEach((i) => console.log('  ', i));
            }
        }
        const proacao = await prisma.proacao.findFirst({ orderBy: { name: 'asc' }, include: { accounts: true } });
        if (proacao) {
            const summary = await planning.getSummary({ sub: 'admin', role: client_1.Role.ADMIN }, proacao.id, 2026);
            const codes = [...new Set((proacao.accounts || [])
                    .map((a) => String(a.code ?? '').trim())
                    .filter(Boolean)
                    .flatMap((code) => {
                    const base = code.split('.')[0]?.trim() ?? '';
                    return base && base !== code ? [code, base] : [code];
                }))];
            const codeSet = new Set(codes);
            const tree = await dre.getTree(budget2026.id, 'DRE');
            const expected = new Array(12).fill(0);
            tree.rows.forEach((row) => {
                const code = String(row.codigo ?? '').trim();
                if (!codeSet.has(code))
                    return;
                for (let m = 1; m <= 12; m += 1) {
                    const key = `2026-${String(m).padStart(2, '0')}`;
                    expected[m - 1] += num(row.valoresPorMes?.[key]?.realizado);
                }
            });
            const got = summary.chart.series.realizadoAnoAtual;
            const diffs = got
                .map((v, i) => ({ month: i + 1, delta: num(v) - num(expected[i]) }))
                .filter((x) => Math.abs(x.delta) > 0.01);
            console.log(`[PLANNING SUMMARY] proacao='${proacao.name}' realized2026_diffs=${diffs.length}`);
            if (diffs.length > 0) {
                diffs.slice(0, 12).forEach((d) => console.log(`  month=${d.month} delta=${d.delta.toFixed(2)}`));
            }
        }
        else {
            console.log('[PLANNING SUMMARY] skipped (no proacao found)');
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
//# sourceMappingURL=tmp-validate-2026-all-views.js.map