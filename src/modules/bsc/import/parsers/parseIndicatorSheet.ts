import * as ExcelJS from 'exceljs';
import { buildHeaderMap, findHeaderColumn, findHeaderRow, getCellValue } from '../utils/headerDetect';
import { parseDateFlexible } from '../utils/date';
import { parseNumberFlexible } from '../utils/normalize';
import { parseMonthFromHeader } from './shared';

export interface ParsedIndicatorMonthlyRow {
  rowIndex: number;
  month: number;
  targetRaw: unknown;
  targetValue: number | null;
  actualRaw: unknown;
  actualValue: number | null;
}

export interface ParsedActionPlanRow {
  rowIndex: number;
  period: string | null;
  fact: string | null;
  priority: string | null;
  cause: string | null;
  action: string | null;
  owner: string | null;
  dueDateIso: string | null;
  effectiveness: string | null;
  relatedIndicators: string | null;
}

export function parseIndicatorSheet(sheet: ExcelJS.Worksheet) {
  const monthlyRows: ParsedIndicatorMonthlyRow[] = [];
  const actionRows: ParsedActionPlanRow[] = [];

  const monthHeaderRow =
    findHeaderRow(sheet, ['JAN', 'FEV']) ??
    findHeaderRow(sheet, ['MAR', 'ABR']) ??
    findHeaderRow(sheet, ['MAI', 'JUN']);

  if (monthHeaderRow) {
    const monthColumns = new Map<number, number>();
    for (let c = 1; c <= sheet.getRow(monthHeaderRow).cellCount; c += 1) {
      const month = parseMonthFromHeader(getCellValue(sheet.getRow(monthHeaderRow).getCell(c)));
      if (month) monthColumns.set(month, c);
    }
    const firstMonthCol = Math.min(...Array.from(monthColumns.values()));
    for (let rowIndex = monthHeaderRow + 1; rowIndex <= Math.min(sheet.rowCount, monthHeaderRow + 24); rowIndex += 1) {
      let rowLabel = '';
      for (let c = 1; c < firstMonthCol; c++) {
        const v = String(getCellValue(sheet.getRow(rowIndex).getCell(c)) ?? '').trim().toUpperCase();
        if (v) { rowLabel = v; break; }
      }
      if (!rowLabel) continue;
      const isMetaRow = rowLabel.includes('META') && !rowLabel.includes('VS');
      const isActualRow = rowLabel.includes('REALIZADO');
      if (!isMetaRow && !isActualRow) continue;

      for (const [month, column] of monthColumns.entries()) {
        const raw = getCellValue(sheet.getRow(rowIndex).getCell(column));
        const current = monthlyRows.find((item) => item.month === month);
        if (!current) {
          monthlyRows.push({
            rowIndex,
            month,
            targetRaw: isMetaRow ? raw : null,
            targetValue: isMetaRow ? parseNumberFlexible(raw) : null,
            actualRaw: isActualRow ? raw : null,
            actualValue: isActualRow ? parseNumberFlexible(raw) : null,
          });
        } else {
          if (isMetaRow) {
            current.targetRaw = raw;
            current.targetValue = parseNumberFlexible(raw);
          }
          if (isActualRow) {
            current.actualRaw = raw;
            current.actualValue = parseNumberFlexible(raw);
          }
        }
      }
    }
  }

  const actionHeaderRow = findHeaderRow(sheet, ['FATO', 'CAUSA', 'ACAO']);
  if (actionHeaderRow) {
    const headerMap = buildHeaderMap(sheet.getRow(actionHeaderRow));
    const periodCol = findHeaderColumn(headerMap, [/PERIODO/]);
    const factCol = findHeaderColumn(headerMap, [/FATO/]);
    const priorityCol = findHeaderColumn(headerMap, [/^P$/, /PRIORIDADE/]);
    const causeCol = findHeaderColumn(headerMap, [/CAUSA/]);
    const actionCol = findHeaderColumn(headerMap, [/ACAO/]);
    const ownerCol = findHeaderColumn(headerMap, [/QUEM/, /RESPONS/]);
    const whenCol = findHeaderColumn(headerMap, [/QUANDO/, /PRAZO/]);
    const effectivenessCol = findHeaderColumn(headerMap, [/EFICAC/, /AVALIAC/]);
    const relatedCol = findHeaderColumn(headerMap, [/INDICADOR/]);

    let consecutiveBlank = 0;
    for (let rowIndex = actionHeaderRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const fact = factCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(factCol)) ?? '').trim() : '';
      const action = actionCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(actionCol)) ?? '').trim() : '';
      const cause = causeCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(causeCol)) ?? '').trim() : '';
      if (!fact && !action && !cause) {
        consecutiveBlank += 1;
        if (consecutiveBlank >= 3) break;
        continue;
      }
      consecutiveBlank = 0;
      const dueRaw = whenCol ? getCellValue(sheet.getRow(rowIndex).getCell(whenCol)) : null;
      actionRows.push({
        rowIndex,
        period: periodCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(periodCol)) ?? '').trim() || null : null,
        fact: fact || null,
        priority: priorityCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(priorityCol)) ?? '').trim() || null : null,
        cause: cause || null,
        action: action || null,
        owner: ownerCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(ownerCol)) ?? '').trim() || null : null,
        dueDateIso: parseDateFlexible(dueRaw),
        effectiveness: effectivenessCol
          ? String(getCellValue(sheet.getRow(rowIndex).getCell(effectivenessCol)) ?? '').trim() || null
          : null,
        relatedIndicators: relatedCol
          ? String(getCellValue(sheet.getRow(rowIndex).getCell(relatedCol)) ?? '').trim() || null
          : null,
      });
    }
  }

  return {
    monthlyRows,
    actionRows,
  };
}

