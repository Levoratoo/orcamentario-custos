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
exports.enforceDre2026CatalogOrder = enforceDre2026CatalogOrder;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const xlsx = __importStar(require("xlsx"));
const dre_utils_1 = require("./dre-utils");
let cachedCatalog = null;
let catalogLoaded = false;
function detectCatalogFile(rootDir) {
    const candidates = fs
        .readdirSync(rootDir)
        .filter((name) => name.toLowerCase().includes('dre 2026') && name.toLowerCase().endsWith('.xlsx'));
    const preferred = candidates.find((name) => name.toLowerCase().includes('orçado')) ??
        candidates.find((name) => name.toLowerCase().includes('orcado')) ??
        candidates[0];
    return preferred ? path.join(rootDir, preferred) : null;
}
function loadCatalog(logger) {
    if (catalogLoaded)
        return cachedCatalog;
    catalogLoaded = true;
    try {
        const rootDir = path.resolve(process.cwd());
        const filePath = detectCatalogFile(rootDir);
        if (!filePath || !fs.existsSync(filePath)) {
            logger?.warn('DRE 2026 catalog file not found; strict catalog filter disabled.');
            cachedCatalog = null;
            return null;
        }
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
        const byCode = new Map();
        const byLabel = new Map();
        let order = 0;
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
            const rawValue = String(rows[rowIndex]?.[0] ?? '');
            const rawLabel = (0, dre_utils_1.sanitizeLabel)(rawValue);
            if (!rawLabel)
                continue;
            const codeMatch = rawLabel.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
            if (codeMatch) {
                const code = codeMatch[1].trim();
                const desc = (0, dre_utils_1.sanitizeLabel)(codeMatch[2]);
                if (!byCode.has(code))
                    byCode.set(code, order);
                const key = (0, dre_utils_1.normalizeDreKey)(desc);
                if (!byLabel.has(key))
                    byLabel.set(key, order);
            }
            else {
                const key = (0, dre_utils_1.normalizeDreKey)(rawLabel);
                if (!byLabel.has(key))
                    byLabel.set(key, order);
            }
            order += 1;
        }
        cachedCatalog = { byCode, byLabel, sourceFile: path.basename(filePath) };
        logger?.log(`DRE 2026 catalog loaded from ${cachedCatalog.sourceFile} with ${order} labels.`);
        return cachedCatalog;
    }
    catch (error) {
        logger?.warn(`Failed loading DRE 2026 catalog: ${error.message}`);
        cachedCatalog = null;
        return null;
    }
}
function enforceDre2026CatalogOrder(rows, logger) {
    const catalog = loadCatalog(logger);
    if (!catalog)
        return rows;
    const filtered = rows.filter((row) => {
        const code = row.codigo ? String(row.codigo).trim() : '';
        if (code && catalog.byCode.has(code))
            return true;
        const labelKey = (0, dre_utils_1.normalizeDreKey)((0, dre_utils_1.sanitizeLabel)(String(row.descricao ?? '')));
        return catalog.byLabel.has(labelKey);
    });
    if (filtered.length === 0) {
        logger?.warn('DRE 2026 strict catalog filter produced 0 rows; skipping strict filter.');
        return rows;
    }
    const sorted = [...filtered].sort((a, b) => {
        const codeA = a.codigo ? String(a.codigo).trim() : '';
        const codeB = b.codigo ? String(b.codigo).trim() : '';
        const keyA = (0, dre_utils_1.normalizeDreKey)((0, dre_utils_1.sanitizeLabel)(String(a.descricao ?? '')));
        const keyB = (0, dre_utils_1.normalizeDreKey)((0, dre_utils_1.sanitizeLabel)(String(b.descricao ?? '')));
        const rankA = (codeA && catalog.byCode.get(codeA)) ?? catalog.byLabel.get(keyA) ?? Number.MAX_SAFE_INTEGER;
        const rankB = (codeB && catalog.byCode.get(codeB)) ?? catalog.byLabel.get(keyB) ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
    });
    logger?.log(`DRE 2026 strict catalog applied: ${sorted.length}/${rows.length} rows.`);
    return sorted;
}
//# sourceMappingURL=dre-2026-catalog.js.map