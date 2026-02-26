"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTabSheet = parseTabSheet;
const headerDetect_1 = require("../utils/headerDetect");
const date_1 = require("../utils/date");
const percent_1 = require("../utils/percent");
const normalize_1 = require("../utils/normalize");
function parseTabSheet(sheet) {
    let headerRow = 1;
    const dateColumns = [];
    for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 40); rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const candidateDates = [];
        for (let column = 1; column <= row.cellCount; column += 1) {
            const date = (0, date_1.parseDateFlexible)((0, headerDetect_1.getCellValue)(row.getCell(column)));
            if (date)
                candidateDates.push({ column, snapshotDate: date });
        }
        if (candidateDates.length >= 2) {
            headerRow = rowIndex;
            dateColumns.push(...candidateDates);
            break;
        }
    }
    const cells = [];
    if (dateColumns.length === 0) {
        return { headerRow, dateColumns, cells };
    }
    for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const wbs = (0, normalize_1.toAsciiUpper)((0, headerDetect_1.getCellValue)(row.getCell(1)));
        const name = (0, normalize_1.toAsciiUpper)((0, headerDetect_1.getCellValue)(row.getCell(2)));
        const wbsOrName = wbs || name;
        if (!wbsOrName)
            continue;
        for (const dateColumn of dateColumns) {
            cells.push({
                rowIndex,
                wbsOrName,
                snapshotDate: dateColumn.snapshotDate,
                percentComplete: (0, percent_1.normalizePercent)((0, headerDetect_1.getCellValue)(row.getCell(dateColumn.column))),
            });
        }
    }
    return { headerRow, dateColumns, cells };
}
//# sourceMappingURL=parseTabSheet.js.map