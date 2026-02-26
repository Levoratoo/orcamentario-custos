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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_1 = require("@prisma/client");
const budget_importer_1 = require("../src/budgets/budget-importer");
const prisma = new client_1.PrismaClient();
function inferYear(columns) {
    for (const c of columns) {
        const m = c.label.match(/(\d{2})\/(\d{4})/);
        if (m)
            return Number(m[2]);
    }
    return 2024;
}
(async () => {
    const filePath = path.resolve(process.cwd(), 'dre 2024 1.xlsx');
    const buffer = fs.readFileSync(filePath);
    const parsed = (0, budget_importer_1.parseDreFile)(buffer, 'dre 2024 1.xlsx');
    const year = inferYear(parsed.columns);
    const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET' }, orderBy: { updatedAt: 'desc' } });
    const actual = await prisma.budget.findFirst({ where: { year, kind: 'ACTUAL' }, orderBy: { updatedAt: 'desc' } });
    if (!budget || !actual) {
        console.log('Budget/Actual not found', { year, budget: !!budget, actual: !!actual });
        process.exit(1);
    }
    const [budgetLines, actualLines] = await Promise.all([
        prisma.dreLine.findMany({ where: { budgetId: budget.id } }),
        prisma.dreLine.findMany({ where: { budgetId: actual.id } }),
    ]);
    const map = new Map();
    for (const line of budgetLines) {
        if (!line.month || line.mode !== client_1.DreMode.PREVISTO)
            continue;
        map.set(`PREVISTO|${line.nodeKey}|${line.month}`, Number(line.value));
    }
    for (const line of actualLines) {
        if (!line.month || line.mode !== client_1.DreMode.REALIZADO)
            continue;
        map.set(`REALIZADO|${line.nodeKey}|${line.month}`, Number(line.value));
    }
    const mismatches = [];
    let checked = 0;
    parsed.rows.forEach((row, rowIndex) => {
        const label = row.label.replace(/\s+/g, ' ').trim();
        const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
        const accountCode = match?.[1];
        const accountName = (match?.[2] ?? label).trim();
        const nodeKey = `${accountCode ?? accountName}-${rowIndex}`;
        parsed.columns.forEach((col, colIndex) => {
            if (!col.month || col.label === 'Total')
                return;
            const mode = col.mode === client_1.DreMode.REALIZADO ? 'REALIZADO' : 'PREVISTO';
            const sheetValue = Number(row.values[colIndex] ?? 0);
            const dbValue = Number(map.get(`${mode}|${nodeKey}|${col.month}`) ?? 0);
            checked += 1;
            if (Math.abs(sheetValue - dbValue) > 0.0001) {
                mismatches.push({ row: rowIndex + 1, label, month: col.month, mode, sheet: sheetValue, db: dbValue });
            }
        });
    });
    console.log(JSON.stringify({
        year,
        budget: { id: budget.id, name: budget.name },
        actual: { id: actual.id, name: actual.name },
        checked,
        mismatches: mismatches.length,
        sample: mismatches.slice(0, 20),
    }, null, 2));
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-dre-2024-match.js.map