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
exports.importRealizadoBaseline2026 = importRealizadoBaseline2026;
exports.resolveRealizadoBaselineFile = resolveRealizadoBaselineFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const xlsx = __importStar(require("xlsx"));
const dre_utils_1 = require("./dre-utils");
function extractAccountCode(rawLabel) {
    const label = rawLabel.replace(/\s+/g, ' ').trim();
    const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
    return match?.[1] ?? (0, dre_utils_1.normalizeDreKey)(label);
}
async function importRealizadoBaseline2026(prisma, filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
    const header = rows[0] ?? [];
    const monthColumns = header
        .map((label, index) => {
        const text = String(label ?? '');
        if (!text)
            return null;
        if (!text.toLowerCase().includes('realizado'))
            return null;
        const match = text.match(/(\d{2})\/(\d{4})/);
        if (!match)
            return null;
        return { index, month: Number(match[1]), year: Number(match[2]) };
    })
        .filter(Boolean);
    const year = 2026;
    const dataMap = new Map();
    const totalsByMonth = {};
    monthColumns.forEach((col) => {
        if (col.year === year)
            totalsByMonth[col.month] = 0;
    });
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] ?? [];
        const rawLabel = String(row[0] ?? '').trim();
        if (!rawLabel)
            continue;
        const accountCode = extractAccountCode(rawLabel);
        for (const col of monthColumns) {
            if (col.year !== year)
                continue;
            const rawValue = row[col.index];
            const value = Number(rawValue ?? 0) || 0;
            totalsByMonth[col.month] = (totalsByMonth[col.month] ?? 0) + value;
            const key = `${year}-${col.month}-${accountCode}`;
            const existing = dataMap.get(key);
            if (existing) {
                existing.value += value;
            }
            else {
                dataMap.set(key, { year, month: col.month, accountCode, value, sourceFile: path.basename(filePath) });
            }
        }
    }
    await prisma.$transaction(async (tx) => {
        await tx.realizedValue.deleteMany({ where: { year } });
        if (dataMap.size > 0) {
            await tx.realizedValue.createMany({ data: Array.from(dataMap.values()) });
        }
    });
    const totalAnnual = Object.values(totalsByMonth).reduce((sum, value) => sum + value, 0);
    return {
        year,
        sourceFile: path.basename(filePath),
        rows: dataMap.size,
        totalAnnual,
        totalsByMonth,
    };
}
function resolveRealizadoBaselineFile() {
    const root = path.resolve(__dirname, '..', '..');
    const candidates = fs.readdirSync(root);
    const file = candidates.find((name) => name.toLowerCase().includes('dre 2026') && name.toLowerCase().includes('orçado')) ??
        candidates.find((name) => name.toLowerCase().includes('dre 2026'));
    if (!file)
        return null;
    return path.join(root, file);
}
//# sourceMappingURL=realized-baseline.importer.js.map