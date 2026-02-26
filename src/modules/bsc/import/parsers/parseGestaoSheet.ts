import * as ExcelJS from 'exceljs';
import { buildHeaderMap, findHeaderColumn, findHeaderRow, getCellValue } from '../utils/headerDetect';
import { parseIndicatorCodeAndName, parseNumberFlexible } from '../utils/normalize';
import { parseMonthFromHeader } from './shared';

export interface ParsedGestaoRow {
  rowIndex: number;
  indicatorCode: string | null;
  indicatorName: string | null;
  yearTargetRaw: unknown;
  yearTargetValue: number | null;
  monthTargets: Array<{ month: number; rawValue: unknown; value: number | null }>;
  monthActuals: Array<{ month: number; rawValue: unknown; value: number | null }>;
}

export function parseGestaoSheet(sheet: ExcelJS.Worksheet) {
  const headerRowIndex =
    findHeaderRow(sheet, ['JAN', 'FEV']) ??
    findHeaderRow(sheet, ['MAR', 'ABR']) ??
    findHeaderRow(sheet, ['MAI', 'JUN']);
  if (!headerRowIndex) return { headerRowIndex: null, rows: [] as ParsedGestaoRow[] };

  const headerMap = buildHeaderMap(sheet.getRow(headerRowIndex));
  const indicatorCodeCol = findHeaderColumn(headerMap, [/CODIGO/, /C[ÓO]D/]);
  const indicatorCol = findHeaderColumn(headerMap, [/INDICADOR/]);
  const yearTargetCol = findHeaderColumn(headerMap, [/META 2025/, /META.*20\d{2}/, /^META$/]);

  const monthTargetCols = new Map<number, number>();
  const monthActualCols = new Map<number, number>();
  for (const [header, column] of headerMap.entries()) {
    const month = parseMonthFromHeader(header);
    if (!month) continue;
    if (header.includes('REALIZADO') || header.includes('REAL')) monthActualCols.set(month, column);
    else monthTargetCols.set(month, column);
  }

  const rows: ParsedGestaoRow[] = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const codeSource = indicatorCodeCol
      ? getCellValue(row.getCell(indicatorCodeCol))
      : indicatorCol
        ? getCellValue(row.getCell(indicatorCol))
        : null;
    const parsed = parseIndicatorCodeAndName(String(codeSource ?? ''));
    const indicatorName =
      parsed.name ||
      (indicatorCol ? String(getCellValue(row.getCell(indicatorCol)) ?? '').trim() || null : null);

    const yearTargetRaw = yearTargetCol ? getCellValue(row.getCell(yearTargetCol)) : null;
    const monthTargets = Array.from(monthTargetCols.entries()).map(([month, column]) => {
      const raw = getCellValue(row.getCell(column));
      return { month, rawValue: raw, value: parseNumberFlexible(raw) };
    });
    const monthActuals = Array.from(monthActualCols.entries()).map(([month, column]) => {
      const raw = getCellValue(row.getCell(column));
      return { month, rawValue: raw, value: parseNumberFlexible(raw) };
    });

    rows.push({
      rowIndex,
      indicatorCode: parsed.code,
      indicatorName,
      yearTargetRaw,
      yearTargetValue: parseNumberFlexible(yearTargetRaw),
      monthTargets,
      monthActuals,
    });
  }

  return { headerRowIndex, rows };
}

