"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGestaoSheet = parseGestaoSheet;
const headerDetect_1 = require("../utils/headerDetect");
const normalize_1 = require("../utils/normalize");
const shared_1 = require("./shared");
function parseGestaoSheet(sheet) {
    const headerRowIndex = (0, headerDetect_1.findHeaderRow)(sheet, ['JAN', 'FEV']) ??
        (0, headerDetect_1.findHeaderRow)(sheet, ['MAR', 'ABR']) ??
        (0, headerDetect_1.findHeaderRow)(sheet, ['MAI', 'JUN']);
    if (!headerRowIndex)
        return { headerRowIndex: null, rows: [] };
    const headerMap = (0, headerDetect_1.buildHeaderMap)(sheet.getRow(headerRowIndex));
    const indicatorCodeCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/CODIGO/, /C[ÓO]D/]);
    const indicatorCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/INDICADOR/]);
    const yearTargetCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/META 2025/, /META.*20\d{2}/, /^META$/]);
    const monthTargetCols = new Map();
    const monthActualCols = new Map();
    for (const [header, column] of headerMap.entries()) {
        const month = (0, shared_1.parseMonthFromHeader)(header);
        if (!month)
            continue;
        if (header.includes('REALIZADO') || header.includes('REAL'))
            monthActualCols.set(month, column);
        else
            monthTargetCols.set(month, column);
    }
    const rows = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const codeSource = indicatorCodeCol
            ? (0, headerDetect_1.getCellValue)(row.getCell(indicatorCodeCol))
            : indicatorCol
                ? (0, headerDetect_1.getCellValue)(row.getCell(indicatorCol))
                : null;
        const parsed = (0, normalize_1.parseIndicatorCodeAndName)(String(codeSource ?? ''));
        const indicatorName = parsed.name ||
            (indicatorCol ? String((0, headerDetect_1.getCellValue)(row.getCell(indicatorCol)) ?? '').trim() || null : null);
        const yearTargetRaw = yearTargetCol ? (0, headerDetect_1.getCellValue)(row.getCell(yearTargetCol)) : null;
        const monthTargets = Array.from(monthTargetCols.entries()).map(([month, column]) => {
            const raw = (0, headerDetect_1.getCellValue)(row.getCell(column));
            return { month, rawValue: raw, value: (0, normalize_1.parseNumberFlexible)(raw) };
        });
        const monthActuals = Array.from(monthActualCols.entries()).map(([month, column]) => {
            const raw = (0, headerDetect_1.getCellValue)(row.getCell(column));
            return { month, rawValue: raw, value: (0, normalize_1.parseNumberFlexible)(raw) };
        });
        rows.push({
            rowIndex,
            indicatorCode: parsed.code,
            indicatorName,
            yearTargetRaw,
            yearTargetValue: (0, normalize_1.parseNumberFlexible)(yearTargetRaw),
            monthTargets,
            monthActuals,
        });
    }
    return { headerRowIndex, rows };
}
//# sourceMappingURL=parseGestaoSheet.js.map