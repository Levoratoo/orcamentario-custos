"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBaseSheet = parseBaseSheet;
const headerDetect_1 = require("../utils/headerDetect");
const date_1 = require("../utils/date");
const percent_1 = require("../utils/percent");
function parseBaseSheet(sheet) {
    const headerRow = (0, headerDetect_1.findHeaderRow)(sheet, ['TAREFA']) ?? (0, headerDetect_1.findHeaderRow)(sheet, ['TASK']);
    if (!headerRow)
        return [];
    const headerMap = (0, headerDetect_1.buildHeaderMap)(sheet.getRow(headerRow));
    const dateCol = 1;
    const wbsCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/WBS/, /ID TAREFA/]) ?? 2;
    const nameCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/TAREFA/, /TASK/, /NOME/]) ?? 3;
    const percentCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/%/, /CONCLUI/]);
    const rows = [];
    for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const snapshotDate = (0, date_1.parseDateFlexible)((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(dateCol)));
        const name = String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(nameCol)) ?? '').trim();
        if (!snapshotDate || !name)
            continue;
        const wbs = String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(wbsCol)) ?? '').trim() || `ROW-${rowIndex}`;
        const percentComplete = percentCol
            ? (0, percent_1.normalizePercent)((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(percentCol)))
            : null;
        rows.push({ rowIndex, snapshotDate, wbs, name, percentComplete });
    }
    return rows;
}
//# sourceMappingURL=parseBaseSheet.js.map