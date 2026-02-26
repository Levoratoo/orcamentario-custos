import * as ExcelJS from 'exceljs';
import { toAsciiUpper } from './normalize';

export function findHeaderRow(sheet: ExcelJS.Worksheet, requiredTokens: string[], maxRows = 80): number | null {
  const keys = requiredTokens.map((token) => toAsciiUpper(token));
  for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, maxRows); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const line = Array.from({ length: row.cellCount }, (_, i) => toAsciiUpper(getCellValue(row.getCell(i + 1)))).join(' | ');
    if (keys.every((key) => line.includes(key))) return rowIndex;
  }
  return null;
}

export function buildHeaderMap(row: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  for (let column = 1; column <= row.cellCount; column += 1) {
    const header = toAsciiUpper(getCellValue(row.getCell(column)));
    if (header) map.set(header, column);
  }
  return map;
}

export function findHeaderColumn(map: Map<string, number>, patterns: RegExp[]): number | null {
  for (const [header, column] of map.entries()) {
    if (patterns.some((pattern) => pattern.test(header))) return column;
  }
  return null;
}

export function getCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value as any;
  if (value == null) return null;
  if (typeof value === 'object' && 'result' in value) return value.result;
  if (typeof value === 'object' && 'text' in value) return value.text;
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((item: any) => item.text).join('');
  }
  return value;
}

