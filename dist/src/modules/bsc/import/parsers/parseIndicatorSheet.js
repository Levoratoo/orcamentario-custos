"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIndicatorSheet = parseIndicatorSheet;
const headerDetect_1 = require("../utils/headerDetect");
const date_1 = require("../utils/date");
const normalize_1 = require("../utils/normalize");
const shared_1 = require("./shared");
function parseIndicatorSheet(sheet) {
    const monthlyRows = [];
    const actionRows = [];
    const monthHeaderRow = (0, headerDetect_1.findHeaderRow)(sheet, ['JAN', 'FEV']) ??
        (0, headerDetect_1.findHeaderRow)(sheet, ['MAR', 'ABR']) ??
        (0, headerDetect_1.findHeaderRow)(sheet, ['MAI', 'JUN']);
    if (monthHeaderRow) {
        const monthColumns = new Map();
        for (let c = 1; c <= sheet.getRow(monthHeaderRow).cellCount; c += 1) {
            const month = (0, shared_1.parseMonthFromHeader)((0, headerDetect_1.getCellValue)(sheet.getRow(monthHeaderRow).getCell(c)));
            if (month)
                monthColumns.set(month, c);
        }
        const firstMonthCol = Math.min(...Array.from(monthColumns.values()));
        for (let rowIndex = monthHeaderRow + 1; rowIndex <= Math.min(sheet.rowCount, monthHeaderRow + 24); rowIndex += 1) {
            let rowLabel = '';
            for (let c = 1; c < firstMonthCol; c++) {
                const v = String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(c)) ?? '').trim().toUpperCase();
                if (v) {
                    rowLabel = v;
                    break;
                }
            }
            if (!rowLabel)
                continue;
            const isMetaRow = rowLabel.includes('META') && !rowLabel.includes('VS');
            const isActualRow = rowLabel.includes('REALIZADO');
            if (!isMetaRow && !isActualRow)
                continue;
            for (const [month, column] of monthColumns.entries()) {
                const raw = (0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(column));
                const current = monthlyRows.find((item) => item.month === month);
                if (!current) {
                    monthlyRows.push({
                        rowIndex,
                        month,
                        targetRaw: isMetaRow ? raw : null,
                        targetValue: isMetaRow ? (0, normalize_1.parseNumberFlexible)(raw) : null,
                        actualRaw: isActualRow ? raw : null,
                        actualValue: isActualRow ? (0, normalize_1.parseNumberFlexible)(raw) : null,
                    });
                }
                else {
                    if (isMetaRow) {
                        current.targetRaw = raw;
                        current.targetValue = (0, normalize_1.parseNumberFlexible)(raw);
                    }
                    if (isActualRow) {
                        current.actualRaw = raw;
                        current.actualValue = (0, normalize_1.parseNumberFlexible)(raw);
                    }
                }
            }
        }
    }
    const actionHeaderRow = (0, headerDetect_1.findHeaderRow)(sheet, ['FATO', 'CAUSA', 'ACAO']);
    if (actionHeaderRow) {
        const headerMap = (0, headerDetect_1.buildHeaderMap)(sheet.getRow(actionHeaderRow));
        const periodCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/PERIODO/]);
        const factCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/FATO/]);
        const priorityCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/^P$/, /PRIORIDADE/]);
        const causeCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/CAUSA/]);
        const actionCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/ACAO/]);
        const ownerCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/QUEM/, /RESPONS/]);
        const whenCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/QUANDO/, /PRAZO/]);
        const effectivenessCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/EFICAC/, /AVALIAC/]);
        const relatedCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/INDICADOR/]);
        let consecutiveBlank = 0;
        for (let rowIndex = actionHeaderRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
            const fact = factCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(factCol)) ?? '').trim() : '';
            const action = actionCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(actionCol)) ?? '').trim() : '';
            const cause = causeCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(causeCol)) ?? '').trim() : '';
            if (!fact && !action && !cause) {
                consecutiveBlank += 1;
                if (consecutiveBlank >= 3)
                    break;
                continue;
            }
            consecutiveBlank = 0;
            const dueRaw = whenCol ? (0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(whenCol)) : null;
            actionRows.push({
                rowIndex,
                period: periodCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(periodCol)) ?? '').trim() || null : null,
                fact: fact || null,
                priority: priorityCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(priorityCol)) ?? '').trim() || null : null,
                cause: cause || null,
                action: action || null,
                owner: ownerCol ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(ownerCol)) ?? '').trim() || null : null,
                dueDateIso: (0, date_1.parseDateFlexible)(dueRaw),
                effectiveness: effectivenessCol
                    ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(effectivenessCol)) ?? '').trim() || null
                    : null,
                relatedIndicators: relatedCol
                    ? String((0, headerDetect_1.getCellValue)(sheet.getRow(rowIndex).getCell(relatedCol)) ?? '').trim() || null
                    : null,
            });
        }
    }
    return {
        monthlyRows,
        actionRows,
    };
}
//# sourceMappingURL=parseIndicatorSheet.js.map