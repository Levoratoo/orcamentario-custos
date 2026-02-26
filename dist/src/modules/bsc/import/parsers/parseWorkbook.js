"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWorkbookSheets = parseWorkbookSheets;
const date_1 = require("../utils/date");
const normalize_1 = require("../utils/normalize");
function parseWorkbookSheets(workbook) {
    const groups = {
        indicatorSheets: [],
        projectSheets: [],
    };
    for (const sheet of workbook.worksheets) {
        const name = (0, normalize_1.toAsciiUpper)(sheet.name);
        if (name === 'MAPA' || name.includes('MAPA ESTRATEGICO')) {
            groups.mapa = sheet;
            continue;
        }
        if (name === 'GESTAO' || name.includes('GESTAO')) {
            groups.gestao = sheet;
            continue;
        }
        if (/^[FCPA]\d+(?:\.\d+){0,2}\b/.test(name)) {
            groups.indicatorSheets.push(sheet);
            continue;
        }
        if (name.includes('.PROJECT')) {
            groups.projectSheets.push({
                sheet,
                snapshotDate: (0, date_1.parseSnapshotDateFromSheetName)(sheet.name),
            });
            continue;
        }
        if (name === 'BASE') {
            groups.baseSheet = sheet;
            continue;
        }
        if (name === 'TAB') {
            groups.tabSheet = sheet;
            continue;
        }
    }
    return groups;
}
//# sourceMappingURL=parseWorkbook.js.map