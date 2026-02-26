import * as ExcelJS from 'exceljs';
import { BscPerspectiveName } from '@prisma/client';
import { buildHeaderMap, findHeaderColumn, findHeaderRow, getCellValue } from '../utils/headerDetect';
import { parseIndicatorCodeAndName, parseNumberFlexible } from '../utils/normalize';

export interface ParsedMapaRow {
  rowIndex: number;
  perspective: BscPerspectiveName | null;
  objective: string;
  indicatorCode: string | null;
  indicatorName: string | null;
  responsible: string | null;
  dataOwner: string | null;
  keywords: string | null;
  level: number | null;
  process: string | null;
  annualTargets: Array<{ year: number; rawValue: unknown; targetValue: number | null }>;
}

function resolvePerspective(raw: unknown): BscPerspectiveName | null {
  const value = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (value.includes('FINANCE')) return BscPerspectiveName.FINANCEIRO;
  if (value.includes('CLIENTE')) return BscPerspectiveName.CLIENTE;
  if (value.includes('PROCESS')) return BscPerspectiveName.PROCESSOS;
  if (value.includes('APRENDIZADO') || value.includes('CRESCIMENTO')) {
    return BscPerspectiveName.APRENDIZADO_CRESCIMENTO;
  }
  return null;
}

export function parseMapaSheet(sheet: ExcelJS.Worksheet) {
  const headerRowIndex = findHeaderRow(sheet, ['PERSPECTIVA', 'OBJETIVO', 'INDICADOR']);
  if (!headerRowIndex) {
    return { headerRowIndex: null, rows: [] as ParsedMapaRow[] };
  }

  const headerMap = buildHeaderMap(sheet.getRow(headerRowIndex));
  const perspectiveCol = findHeaderColumn(headerMap, [/PERSPECTIVA/]);
  const objectiveCol = findHeaderColumn(headerMap, [/OBJETIV/]);
  const indicatorCol = findHeaderColumn(headerMap, [/INDICADOR/]);
  const indicatorCodeCol = findHeaderColumn(headerMap, [/CODIGO/, /C[ÓO]D/]);
  const responsibleCol = findHeaderColumn(headerMap, [/RESPONS/]);
  const dataOwnerCol = findHeaderColumn(headerMap, [/ALIMENTADOR/, /DATA OWNER/]);
  const keywordsCol = findHeaderColumn(headerMap, [/PALAVRA.*CHAVE/, /KEYWORD/]);
  const levelCol = findHeaderColumn(headerMap, [/NIVEL/]);
  const processCol = findHeaderColumn(headerMap, [/PROCESSO/]);

  const yearColumns = new Map<number, number>();
  for (const [header, column] of headerMap.entries()) {
    const yearMatch = header.match(/20\d{2}/);
    if (yearMatch) yearColumns.set(Number(yearMatch[0]), column);
  }

  const rows: ParsedMapaRow[] = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const perspectiveRaw = perspectiveCol ? getCellValue(row.getCell(perspectiveCol)) : null;
    const objective = objectiveCol ? String(getCellValue(row.getCell(objectiveCol)) ?? '').trim() : '';
    const codeSource = indicatorCodeCol
      ? getCellValue(row.getCell(indicatorCodeCol))
      : indicatorCol
        ? getCellValue(row.getCell(indicatorCol))
        : null;
    const parsed = parseIndicatorCodeAndName(String(codeSource ?? ''));
    const indicatorName =
      parsed.name ||
      (indicatorCol ? String(getCellValue(row.getCell(indicatorCol)) ?? '').trim() : null);

    const annualTargets = Array.from(yearColumns.entries()).map(([year, column]) => {
      const raw = getCellValue(row.getCell(column));
      return {
        year,
        rawValue: raw,
        targetValue: parseNumberFlexible(raw),
      };
    });

    rows.push({
      rowIndex,
      perspective: resolvePerspective(perspectiveRaw),
      objective,
      indicatorCode: parsed.code,
      indicatorName,
      responsible: responsibleCol ? String(getCellValue(row.getCell(responsibleCol)) ?? '').trim() || null : null,
      dataOwner: dataOwnerCol ? String(getCellValue(row.getCell(dataOwnerCol)) ?? '').trim() || null : null,
      keywords: keywordsCol ? String(getCellValue(row.getCell(keywordsCol)) ?? '').trim() || null : null,
      level: levelCol ? parseNumberFlexible(getCellValue(row.getCell(levelCol))) : null,
      process: processCol ? String(getCellValue(row.getCell(processCol)) ?? '').trim() || null : null,
      annualTargets,
    });
  }

  return { headerRowIndex, rows };
}
