"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeHtmlEntities = decodeHtmlEntities;
exports.sanitizeLabel = sanitizeLabel;
exports.applyParentIdsByLevel = applyParentIdsByLevel;
exports.computeProjectedValue = computeProjectedValue;
exports.computeProjectedSeries = computeProjectedSeries;
exports.computeExerciseAccumulatedFromSeries = computeExerciseAccumulatedFromSeries;
exports.computeRealizedAccumulatedFromSeries = computeRealizedAccumulatedFromSeries;
exports.computeRealizedMonthlyFromSeries = computeRealizedMonthlyFromSeries;
exports.computeDeltaMetrics = computeDeltaMetrics;
exports.normalizeDreKey = normalizeDreKey;
exports.normalizeDreHierarchy = normalizeDreHierarchy;
exports.inspectDreHierarchy = inspectDreHierarchy;
const htmlNamedEntityMap = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    '#39': "'",
};
const CONTROL_CHARS_REGEX = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');
function decodeHtmlEntities(input) {
    if (!input)
        return input;
    const namedDecoded = input.replace(/&([a-zA-Z]+|#39);/g, (match, entity) => {
        const replacement = htmlNamedEntityMap[entity];
        return replacement !== undefined ? replacement : match;
    });
    return namedDecoded
        .replace(/&#(\d+);/g, (_match, code) => {
        const value = Number(code);
        return Number.isFinite(value) ? String.fromCharCode(value) : _match;
    })
        .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => {
        const value = Number.parseInt(code, 16);
        return Number.isFinite(value) ? String.fromCharCode(value) : _match;
    });
}
function sanitizeLabel(label) {
    const decoded = decodeHtmlEntities(label);
    return decoded
        .replace(/\u00A0/g, ' ')
        .replace(CONTROL_CHARS_REGEX, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function applyParentIdsByLevel(rows) {
    const stack = [];
    rows.forEach((row) => {
        while (stack.length > 0 && stack[stack.length - 1].nivel >= row.nivel) {
            stack.pop();
        }
        row.parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
        stack.push({ nivel: row.nivel, id: row.id });
    });
    return rows;
}
function computeProjectedValue(month, previsto, realizado, lastClosedMonth) {
    if (lastClosedMonth > 0 && month <= lastClosedMonth) {
        return realizado ?? 0;
    }
    return previsto ?? 0;
}
function computeProjectedSeries(previstos, realizados, lastClosedMonth) {
    const size = Math.max(previstos.length, realizados.length);
    return Array.from({ length: size }, (_, index) => {
        const month = index + 1;
        return computeProjectedValue(month, previstos[index] ?? 0, realizados[index] ?? 0, lastClosedMonth);
    });
}
function computeExerciseAccumulatedFromSeries(previstos, realizados, cutoffMonth, lastClosedMonth) {
    const limit = Math.max(0, Math.min(12, cutoffMonth));
    let total = 0;
    for (let month = 1; month <= limit; month += 1) {
        const previsto = previstos[month - 1] ?? 0;
        const realizado = realizados[month - 1] ?? 0;
        total += computeProjectedValue(month, previsto, realizado, lastClosedMonth);
    }
    return total;
}
function computeRealizedAccumulatedFromSeries(realizados, cutoffMonth) {
    const limit = Math.max(0, Math.min(12, cutoffMonth));
    let total = 0;
    for (let month = 1; month <= limit; month += 1) {
        total += realizados[month - 1] ?? 0;
    }
    return total;
}
function computeRealizedMonthlyFromSeries(realizados, month) {
    const selectedMonth = Math.max(1, Math.min(12, month));
    return realizados[selectedMonth - 1] ?? 0;
}
function computeDeltaMetrics(current, previous) {
    const deltaValue = current - previous;
    const deltaPct = previous === 0 ? null : deltaValue / previous;
    return { deltaValue, deltaPct };
}
function normalizeDreKey(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
function deriveLevelFromCode(code) {
    if (!code)
        return 0;
    const normalized = String(code).trim();
    if (!normalized)
        return 0;
    const parts = normalized.split('.').filter(Boolean);
    if (parts.length > 1)
        return parts.length - 1;
    return 0;
}
function coerceLevel(value) {
    if (value === null || value === undefined)
        return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0)
        return null;
    return num;
}
function normalizeDreHierarchy(rows) {
    if (rows.length === 0)
        return rows;
    const withIndex = rows.map((row, index) => ({ row, index }));
    const idSet = new Set(withIndex.map(({ row }) => row.id));
    withIndex.sort((a, b) => {
        const aOrder = a.row.sortOrder ?? a.index;
        const bOrder = b.row.sortOrder ?? b.index;
        if (aOrder === bOrder)
            return a.index - b.index;
        return aOrder - bOrder;
    });
    const coercedLevels = withIndex.map(({ row }) => coerceLevel(row.nivel ?? row.level));
    const hasAnyLevel = coercedLevels.some((value) => value !== null);
    const derivedLevels = withIndex.map(({ row }) => deriveLevelFromCode(row.codigo));
    const derivedHasDepth = derivedLevels.some((value) => value > 0);
    const useDerived = !hasAnyLevel || (coercedLevels.filter((value) => (value ?? 0) === 0).length / rows.length > 0.9 && derivedHasDepth);
    const lastIdByLevel = {};
    const lastPathByLevel = {};
    const levelById = {};
    const pathById = {};
    const normalized = withIndex.map(({ row }, idx) => {
        const rawLevel = useDerived ? derivedLevels[idx] : (coercedLevels[idx] ?? 0);
        const explicitParentId = row.parentId && idSet.has(row.parentId) ? row.parentId : null;
        const parentId = explicitParentId ?? (rawLevel > 0 ? lastIdByLevel[rawLevel - 1] ?? null : null);
        const parentLevel = parentId ? levelById[parentId] : undefined;
        const level = parentId && Number.isFinite(parentLevel) ? Number(parentLevel) + 1 : rawLevel;
        const baseKey = row.codigo ? String(row.codigo) : String(row.id);
        const parentPathId = parentId
            ? pathById[parentId] ?? row.parentPathId ?? null
            : level > 0
                ? lastPathByLevel[level - 1] ?? null
                : null;
        const pathId = parentPathId ? `${parentPathId}/${baseKey}` : baseKey;
        lastIdByLevel[level] = row.id;
        lastPathByLevel[level] = pathId;
        levelById[row.id] = level;
        pathById[row.id] = pathId;
        return {
            ...row,
            nivel: level,
            parentId,
            pathId,
            parentPathId,
        };
    });
    return normalized;
}
function inspectDreHierarchy(rows) {
    const total = rows.length;
    const idSet = new Set(rows.map((row) => row.id));
    const roots = rows.filter((row) => !row.parentId).length;
    const missingParents = rows.filter((row) => row.parentId && !idSet.has(row.parentId)).length;
    const levelZero = rows.filter((row) => (row.nivel ?? 0) === 0).length;
    const levelZeroPct = total > 0 ? levelZero / total : 1;
    return {
        total,
        roots,
        missingParents,
        levelZeroPct,
        invalid: roots > total * 0.6 || missingParents > 0 || levelZeroPct > 0.9,
    };
}
//# sourceMappingURL=dre-utils.js.map