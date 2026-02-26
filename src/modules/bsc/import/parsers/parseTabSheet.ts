import * as ExcelJS from 'exceljs';
import { getCellValue } from '../utils/headerDetect';
import { parseDateFlexible } from '../utils/date';
import { normalizePercent } from '../utils/percent';
import { toAsciiUpper } from '../utils/normalize';

export interface ParsedTabSnapshotCell {
  rowIndex: number;
  wbsOrName: string;
  snapshotDate: string;
  percentComplete: number | null;
}

export function parseTabSheet(sheet: ExcelJS.Worksheet) {
  let headerRow = 1;
  const dateColumns: Array<{ column: number; snapshotDate: string }> = [];
  for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 40); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const candidateDates: Array<{ column: number; snapshotDate: string }> = [];
    for (let column = 1; column <= row.cellCount; column += 1) {
      const date = parseDateFlexible(getCellValue(row.getCell(column)));
      if (date) candidateDates.push({ column, snapshotDate: date });
    }
    if (candidateDates.length >= 2) {
      headerRow = rowIndex;
      dateColumns.push(...candidateDates);
      break;
    }
  }

  const cells: ParsedTabSnapshotCell[] = [];
  if (dateColumns.length === 0) {
    return { headerRow, dateColumns, cells };
  }

  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const wbs = toAsciiUpper(getCellValue(row.getCell(1)));
    const name = toAsciiUpper(getCellValue(row.getCell(2)));
    const wbsOrName = wbs || name;
    if (!wbsOrName) continue;
    for (const dateColumn of dateColumns) {
      cells.push({
        rowIndex,
        wbsOrName,
        snapshotDate: dateColumn.snapshotDate,
        percentComplete: normalizePercent(getCellValue(row.getCell(dateColumn.column))),
      });
    }
  }

  return { headerRow, dateColumns, cells };
}

