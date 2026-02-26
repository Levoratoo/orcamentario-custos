import * as ExcelJS from 'exceljs';
import { buildHeaderMap, findHeaderColumn, findHeaderRow, getCellValue } from '../utils/headerDetect';
import { parseDateFlexible } from '../utils/date';
import { normalizePercent } from '../utils/percent';

export interface ParsedBaseRow {
  rowIndex: number;
  snapshotDate: string;
  wbs: string;
  name: string;
  percentComplete: number | null;
}

export function parseBaseSheet(sheet: ExcelJS.Worksheet): ParsedBaseRow[] {
  const headerRow = findHeaderRow(sheet, ['TAREFA']) ?? findHeaderRow(sheet, ['TASK']);
  if (!headerRow) return [];
  const headerMap = buildHeaderMap(sheet.getRow(headerRow));
  const dateCol = 1;
  const wbsCol = findHeaderColumn(headerMap, [/WBS/, /ID TAREFA/]) ?? 2;
  const nameCol = findHeaderColumn(headerMap, [/TAREFA/, /TASK/, /NOME/]) ?? 3;
  const percentCol = findHeaderColumn(headerMap, [/%/, /CONCLUI/]);
  const rows: ParsedBaseRow[] = [];
  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const snapshotDate = parseDateFlexible(getCellValue(sheet.getRow(rowIndex).getCell(dateCol)));
    const name = String(getCellValue(sheet.getRow(rowIndex).getCell(nameCol)) ?? '').trim();
    if (!snapshotDate || !name) continue;
    const wbs = String(getCellValue(sheet.getRow(rowIndex).getCell(wbsCol)) ?? '').trim() || `ROW-${rowIndex}`;
    const percentComplete = percentCol
      ? normalizePercent(getCellValue(sheet.getRow(rowIndex).getCell(percentCol)))
      : null;
    rows.push({ rowIndex, snapshotDate, wbs, name, percentComplete });
  }
  return rows;
}

