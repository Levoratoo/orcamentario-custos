"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findHeaderRow = findHeaderRow;
exports.buildHeaderMap = buildHeaderMap;
exports.findHeaderColumn = findHeaderColumn;
exports.getCellValue = getCellValue;
const normalize_1 = require("./normalize");
function findHeaderRow(sheet, requiredTokens, maxRows = 80) {
    const keys = requiredTokens.map((token) => (0, normalize_1.toAsciiUpper)(token));
    for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, maxRows); rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const line = Array.from({ length: row.cellCount }, (_, i) => (0, normalize_1.toAsciiUpper)(getCellValue(row.getCell(i + 1)))).join(' | ');
        if (keys.every((key) => line.includes(key)))
            return rowIndex;
    }
    return null;
}
function buildHeaderMap(row) {
    const map = new Map();
    for (let column = 1; column <= row.cellCount; column += 1) {
        const header = (0, normalize_1.toAsciiUpper)(getCellValue(row.getCell(column)));
        if (header)
            map.set(header, column);
    }
    return map;
}
function findHeaderColumn(map, patterns) {
    for (const [header, column] of map.entries()) {
        if (patterns.some((pattern) => pattern.test(header)))
            return column;
    }
    return null;
}
function getCellValue(cell) {
    const value = cell.value;
    if (value == null)
        return null;
    if (typeof value === 'object' && 'result' in value)
        return value.result;
    if (typeof value === 'object' && 'text' in value)
        return value.text;
    if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item) => item.text).join('');
    }
    return value;
}
//# sourceMappingURL=headerDetect.js.map