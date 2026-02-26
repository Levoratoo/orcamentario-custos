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
const norm = (s) => String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
function loadSheet(file) {
    const wb = xlsx.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    return rows.slice(1).map((row, i) => ({
        rank: i,
        rawLabel: String(row[0] ?? ''),
        label: String(row[0] ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim(),
        key: norm(String(row[0] ?? '').replace(/^\s*\d+(?:\.\d+)*\s*-\s*/u, '')),
        totalPrev: Number(row[25] ?? 0) || 0,
    }));
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    try {
        const prisma = app.get(prisma_service_1.PrismaService);
        const dre = app.get(dre_service_1.DreService);
        const budget = await prisma.budget.findFirst({
            where: { year: 2026, kind: 'BUDGET', status: 'READY' },
            orderBy: { updatedAt: 'desc' },
        });
        if (!budget)
            throw new Error('Budget 2026 READY not found');
        const tree = await dre.getTree(budget.id, 'DRE');
        const sys = tree.rows.map((row, i) => ({
            rank: i,
            label: String(row.descricao ?? '').replace(/\s+/g, ' ').trim(),
            key: norm(String(row.descricao ?? '').replace(/^\s*\d+(?:\.\d+)*\s*-\s*/u, '')),
            totalPrev: tree.months.reduce((acc, m) => acc + Number(row.valoresPorMes?.[m]?.previsto ?? 0), 0),
        }));
        const sheet = loadSheet('dre expandida.xlsx');
        console.log('SYSTEM_ROWS', sys.length);
        console.log('SHEET_ROWS', sheet.length);
        let orderMismatch = 0;
        const min = Math.min(sys.length, sheet.length);
        for (let i = 0; i < min; i += 1) {
            if (sys[i].key !== sheet[i].key)
                orderMismatch += 1;
        }
        console.log('ORDER_MISMATCH_SAME_INDEX', orderMismatch);
        const sysCounts = new Map();
        const shCounts = new Map();
        sys.forEach((x) => sysCounts.set(x.key, (sysCounts.get(x.key) ?? 0) + 1));
        sheet.forEach((x) => shCounts.set(x.key, (shCounts.get(x.key) ?? 0) + 1));
        const missingInSystem = [];
        shCounts.forEach((count, key) => {
            if ((sysCounts.get(key) ?? 0) < count)
                missingInSystem.push(`${key} x${count - (sysCounts.get(key) ?? 0)}`);
        });
        const extraInSystem = [];
        sysCounts.forEach((count, key) => {
            if ((shCounts.get(key) ?? 0) < count)
                extraInSystem.push(`${key} x${count - (shCounts.get(key) ?? 0)}`);
        });
        console.log('MISSING_IN_SYSTEM', missingInSystem.length);
        missingInSystem.slice(0, 30).forEach((x) => console.log('  MISS', x));
        console.log('EXTRA_IN_SYSTEM', extraInSystem.length);
        extraInSystem.slice(0, 30).forEach((x) => console.log('  EXTRA', x));
        const byKeyQueue = new Map();
        sys.forEach((x) => {
            const q = byKeyQueue.get(x.key) ?? [];
            q.push({ totalPrev: x.totalPrev, label: x.label, rank: x.rank });
            byKeyQueue.set(x.key, q);
        });
        const valueDiffs = [];
        sheet.forEach((x) => {
            const q = byKeyQueue.get(x.key) ?? [];
            const matched = q.shift();
            byKeyQueue.set(x.key, q);
            if (!matched)
                return;
            const delta = matched.totalPrev - x.totalPrev;
            if (Math.abs(delta) > 0.01) {
                valueDiffs.push({
                    key: x.key,
                    sheetLabel: x.label,
                    sheetRank: x.rank,
                    sheetValue: x.totalPrev,
                    sysRank: matched.rank,
                    sysValue: matched.totalPrev,
                    delta,
                });
            }
        });
        console.log('VALUE_DIFFS', valueDiffs.length);
        valueDiffs.slice(0, 80).forEach((d) => {
            console.log(`  VAL key=${d.key} sheetRank=${d.sheetRank} sysRank=${d.sysRank} delta=${d.delta.toFixed(2)} | ${d.sheetLabel}`);
        });
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=tmp-verify-dre-expandida.js.map