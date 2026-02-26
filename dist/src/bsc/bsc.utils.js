"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTH_ALIASES = void 0;
exports.toAsciiUpper = toAsciiUpper;
exports.slugify = slugify;
exports.getFileHashSha256 = getFileHashSha256;
exports.parseNumberFlexible = parseNumberFlexible;
exports.parsePercentNormalized = parsePercentNormalized;
exports.parseDateFlexible = parseDateFlexible;
exports.parseSnapshotDateFromSheetName = parseSnapshotDateFromSheetName;
exports.parseIndicatorCodeAndName = parseIndicatorCodeAndName;
exports.resolvePerspective = resolvePerspective;
exports.parseMonthFromLabel = parseMonthFromLabel;
exports.inferWbsLevel = inferWbsLevel;
exports.inferParentWbs = inferParentWbs;
exports.computeIndicatorStatus = computeIndicatorStatus;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
exports.MONTH_ALIASES = {
    JAN: 1,
    JANEIRO: 1,
    FEV: 2,
    FEVEREIRO: 2,
    MAR: 3,
    MARCO: 3,
    ABR: 4,
    ABRIL: 4,
    MAI: 5,
    MAIO: 5,
    JUN: 6,
    JUNHO: 6,
    JUL: 7,
    JULHO: 7,
    AGO: 8,
    AGOSTO: 8,
    SET: 9,
    SETEMBRO: 9,
    OUT: 10,
    OUTUBRO: 10,
    NOV: 11,
    NOVEMBRO: 11,
    DEZ: 12,
    DEZEMBRO: 12,
};
function toAsciiUpper(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
function slugify(value) {
    return toAsciiUpper(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function getFileHashSha256(buffer) {
    return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
}
function parseNumberFlexible(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw)
        return null;
    if (/^[-+]?[\d.,]+%$/.test(raw)) {
        return parsePercentNormalized(raw);
    }
    const cleaned = raw
        .replace(/\s/g, '')
        .replace(/R\$/gi, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function parsePercentNormalized(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            return null;
        if (value > 1)
            return value / 100;
        if (value < 0)
            return value;
        return value;
    }
    const raw = String(value).trim();
    if (!raw)
        return null;
    const hasPct = raw.includes('%');
    const numeric = parseNumberFlexible(raw.replace('%', ''));
    if (numeric === null)
        return null;
    if (hasPct)
        return numeric / 100;
    if (numeric > 1)
        return numeric / 100;
    return numeric;
}
function parseDateFlexible(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const result = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
        return result.toISOString().slice(0, 10);
    }
    const raw = String(value).trim();
    if (!raw)
        return null;
    const isoMatch = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const brMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (brMatch) {
        const day = brMatch[1].padStart(2, '0');
        const month = brMatch[2].padStart(2, '0');
        const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
        return `${year}-${month}-${day}`;
    }
    return null;
}
function parseSnapshotDateFromSheetName(sheetName) {
    const normalized = toAsciiUpper(sheetName);
    const match = normalized.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (!match)
        return null;
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2]}-${match[1]}`;
}
function parseIndicatorCodeAndName(raw) {
    const value = String(raw ?? '').trim();
    if (!value)
        return { code: null, name: null };
    const match = value.match(/^([FCPA]\d+(?:\.\d+)*)\s*[-–:]?\s*(.*)$/i);
    if (!match)
        return { code: null, name: value || null };
    return {
        code: match[1].toUpperCase(),
        name: match[2]?.trim() || null,
    };
}
function resolvePerspective(value) {
    const normalized = toAsciiUpper(value);
    if (!normalized)
        return null;
    if (normalized.includes('FINANCE'))
        return client_1.BscPerspectiveName.FINANCEIRO;
    if (normalized.includes('CLIENTE'))
        return client_1.BscPerspectiveName.CLIENTE;
    if (normalized.includes('PROCESS'))
        return client_1.BscPerspectiveName.PROCESSOS;
    if (normalized.includes('APRENDIZADO') || normalized.includes('CRESCIMENTO')) {
        return client_1.BscPerspectiveName.APRENDIZADO_CRESCIMENTO;
    }
    return null;
}
function parseMonthFromLabel(label) {
    const normalized = toAsciiUpper(label).replace(/[^A-Z0-9]/g, '');
    if (!normalized)
        return null;
    if (/^(0?[1-9]|1[0-2])$/.test(normalized))
        return Number(normalized);
    for (const [name, month] of Object.entries(exports.MONTH_ALIASES)) {
        if (normalized.startsWith(name))
            return month;
    }
    return null;
}
function inferWbsLevel(wbs) {
    if (!wbs)
        return null;
    const normalized = String(wbs).trim();
    if (!normalized)
        return null;
    return normalized.split('.').length;
}
function inferParentWbs(wbs) {
    if (!wbs)
        return null;
    const parts = String(wbs).trim().split('.');
    if (parts.length <= 1)
        return null;
    return parts.slice(0, -1).join('.');
}
function computeIndicatorStatus(targetValue, actualValue, direction) {
    if (targetValue === null || actualValue === null || targetValue === 0 || actualValue === 0) {
        return { attainment: null, status: 'SEM_DADOS' };
    }
    const attainment = direction === 'LOWER_IS_BETTER' ? targetValue / actualValue : actualValue / targetValue;
    if (attainment >= 1)
        return { attainment, status: 'VERDE' };
    if (attainment >= 0.9)
        return { attainment, status: 'AMARELO' };
    return { attainment, status: 'VERMELHO' };
}
//# sourceMappingURL=bsc.utils.js.map