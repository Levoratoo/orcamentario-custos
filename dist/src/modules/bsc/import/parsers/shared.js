"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMonthFromHeader = parseMonthFromHeader;
const normalize_1 = require("../utils/normalize");
const MONTH_ALIASES = {
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
function parseMonthFromHeader(value) {
    const normalized = (0, normalize_1.toAsciiUpper)(value).replace(/[^A-Z0-9]/g, '');
    if (!normalized)
        return null;
    if (/^(0?[1-9]|1[0-2])$/.test(normalized))
        return Number(normalized);
    for (const [alias, month] of Object.entries(MONTH_ALIASES)) {
        if (normalized.startsWith(alias))
            return month;
    }
    return null;
}
//# sourceMappingURL=shared.js.map