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
exports.invalidateDre2026SheetCache = invalidateDre2026SheetCache;
exports.getDre2026SheetData = getDre2026SheetData;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const xlsx = __importStar(require("xlsx"));
const dre_utils_1 = require("./dre-utils");
let cached = null;
let loaded = false;
function invalidateDre2026SheetCache() {
    cached = null;
    loaded = false;
}
function findSheetFile(rootDir) {
    const normalizeFileName = (value) => value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const candidates = fs
        .readdirSync(rootDir)
        .filter((name) => name.toLowerCase().endsWith('.xlsx'))
        .map((name) => ({ name, key: normalizeFileName(name) }));
    const pick = (predicate) => candidates.find((item) => predicate(item.key))?.name;
    const preferred = pick((key) => key.includes('dados dre') && key.includes('realizado')) ??
        pick((key) => key.includes('dados') && key.includes('dre') && key.includes('realizado')) ??
        pick((key) => key.includes('dre expandida')) ??
        pick((key) => key.includes('dre recolhida')) ??
        pick((key) => key.includes('dre 2026') && key.includes('orcado')) ??
        pick((key) => key.includes('dre 2026')) ??
        candidates.find((item) => item.key.includes('dre'))?.name;
    return preferred ? path.join(rootDir, preferred) : null;
}
function extractMonthColumns(header) {
    const monthCols = [];
    header.forEach((col, index) => {
        const text = (0, dre_utils_1.sanitizeLabel)(String(col ?? ''));
        const match = text.match(/^(\d{2})\/(\d{4})\((Previsto|Realizado)\)$/i);
        if (!match)
            return;
        monthCols.push({
            index,
            month: Number(match[1]),
            year: Number(match[2]),
            kind: match[3].toUpperCase(),
        });
    });
    return monthCols;
}
function ensureMonth(map, month) {
    const existing = map.get(month);
    if (existing)
        return existing;
    const created = { previsto: 0, realizado: 0 };
    map.set(month, created);
    return created;
}
function getDre2026SheetData(logger) {
    if (loaded)
        return cached;
    loaded = true;
    try {
        const root = path.resolve(process.cwd());
        const filePath = findSheetFile(root);
        if (!filePath || !fs.existsSync(filePath)) {
            logger?.warn('DRE 2026 sheet not found. Sheet override disabled.');
            cached = null;
            return null;
        }
        const workbook = xlsx.readFile(filePath);
        const normalizedSheetName = (value) => value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        let selectedSheetName = null;
        let selectedRows = [];
        let selectedMonthCols = [];
        let bestScore = -1;
        workbook.SheetNames.forEach((sheetName) => {
            const ws = workbook.Sheets[sheetName];
            if (!ws)
                return;
            const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
            const header = rows[0] ?? [];
            const monthCols = extractMonthColumns(header);
            const monthCols2026 = monthCols.filter((col) => col.year === 2026);
            if (monthCols2026.length === 0)
                return;
            const normalized = normalizedSheetName(sheetName);
            const sheetBonus = normalized.includes('2026 mensal') ? 1000 : 0;
            const score = sheetBonus + monthCols2026.length;
            if (score > bestScore) {
                bestScore = score;
                selectedSheetName = sheetName;
                selectedRows = rows;
                selectedMonthCols = monthCols2026;
            }
        });
        if (!selectedSheetName || selectedMonthCols.length === 0) {
            logger?.warn(`DRE 2026 sheet '${path.basename(filePath)}' has no valid MM/YYYY(Previsto|Realizado) columns for 2026.`);
            cached = null;
            return null;
        }
        const rows = selectedRows;
        const monthCols = selectedMonthCols;
        const entries = [];
        let rank = 0;
        for (let i = 1; i < rows.length; i += 1) {
            const row = rows[i] ?? [];
            const rawLabel = (0, dre_utils_1.sanitizeLabel)(String(row[0] ?? ''));
            if (!rawLabel)
                continue;
            const codeMatch = rawLabel.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
            const code = codeMatch?.[1]?.trim() ?? null;
            const label = (0, dre_utils_1.sanitizeLabel)(codeMatch?.[2] ?? rawLabel);
            const labelKey = (0, dre_utils_1.normalizeDreKey)(label);
            const keyMap = new Map();
            monthCols.forEach((col) => {
                if (col.year !== 2026)
                    return;
                const value = Number(row[col.index] ?? 0) || 0;
                const monthCell = ensureMonth(keyMap, col.month);
                if (col.kind === 'PREVISTO')
                    monthCell.previsto = value;
                else
                    monthCell.realizado = value;
            });
            entries.push({
                code,
                label,
                labelKey,
                rank,
                months: keyMap,
            });
            rank += 1;
        }
        cached = {
            sourceFile: path.basename(filePath),
            entries,
        };
        logger?.log(`DRE 2026 sheet override loaded from ${cached.sourceFile} [sheet: ${selectedSheetName}].`);
        return cached;
    }
    catch (error) {
        logger?.warn(`Failed loading DRE 2026 sheet override: ${error.message}`);
        cached = null;
        return null;
    }
}
//# sourceMappingURL=dre-2026-sheet.js.map