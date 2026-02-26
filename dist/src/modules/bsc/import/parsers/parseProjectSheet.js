"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProjectSheet = parseProjectSheet;
const headerDetect_1 = require("../utils/headerDetect");
const date_1 = require("../utils/date");
const percent_1 = require("../utils/percent");
const normalize_1 = require("../utils/normalize");
function parseProjectSheet(sheet) {
    const snapshotDate = (0, date_1.parseSnapshotDateFromSheetName)(sheet.name);
    const headerRow = (0, headerDetect_1.findHeaderRow)(sheet, ['TAREFA']) ?? (0, headerDetect_1.findHeaderRow)(sheet, ['TASK']);
    const projectName = extractProjectName(sheet) ?? 'BSC Printbag';
    const tasks = [];
    if (!headerRow) {
        return { sheetName: sheet.name, snapshotDate, projectName, tasks };
    }
    const headerMap = (0, headerDetect_1.buildHeaderMap)(sheet.getRow(headerRow));
    const wbsCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/WBS/, /ID TAREFA/]) ?? 1;
    const nameCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/NOME DA TAREFA/, /TASK NAME/, /TAREFA/, /^NOME$/]) ?? 2;
    const assigneeCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/ATRIBU/, /ASSIGNEE/, /RESPONSAVEL/]);
    const startCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/INICIO/, /^START$/]);
    const endCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/CONCLUIR/, /TERMINO/, /^FINISH$/]);
    const durationCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/DURACAO/, /DURATION/]);
    const bucketCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/BUCKET/, /PERSPECTIVA/, /CATEGORIA/]);
    const percentCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/% CONCLUIDA/, /% COMPLETE/, /PERCENT/]);
    for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const name = String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(nameCol)) ?? '').trim();
        if (!name)
            continue;
        const wbs = String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(wbsCol)) ?? '').trim() || `ROW-${rowIndex}`;
        tasks.push({
            rowIndex,
            wbs,
            name,
            assignee: assigneeCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(assigneeCol)) ?? '').trim() || null : null,
            startDateIso: startCol ? (0, date_1.parseDateFlexible)((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(startCol))) : null,
            endDateIso: endCol ? (0, date_1.parseDateFlexible)((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(endCol))) : null,
            duration: durationCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(durationCol)) ?? '').trim() || null : null,
            bucket: bucketCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(bucketCol)) ?? '').trim() || null : null,
            percentComplete: percentCol ? (0, percent_1.normalizePercent)((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(percentCol))) : null,
        });
    }
    return { sheetName: sheet.name, snapshotDate, projectName, tasks };
}
function extractProjectName(sheet) {
    for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 12); rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        for (let column = 1; column <= row.cellCount; column += 1) {
            const value = String((0, headerDetect_1.getCellValue)(row.getCell(column)) ?? '').trim();
            if (!value)
                continue;
            const upper = (0, normalize_1.toAsciiUpper)(value);
            if (upper.startsWith('PROJECT:') || upper.startsWith('PROJETO:')) {
                return value.split(':').slice(1).join(':').trim();
            }
        }
    }
    return null;
}
//# sourceMappingURL=parseProjectSheet.js.map