import * as ExcelJS from 'exceljs';
import { buildHeaderMap, findHeaderColumn, findHeaderRow, getCellValue } from '../utils/headerDetect';
import { parseDateFlexible, parseSnapshotDateFromSheetName } from '../utils/date';
import { normalizePercent } from '../utils/percent';
import { toAsciiUpper } from '../utils/normalize';

export interface ParsedProjectTask {
  rowIndex: number;
  wbs: string;
  name: string;
  assignee: string | null;
  startDateIso: string | null;
  endDateIso: string | null;
  duration: string | null;
  bucket: string | null;
  percentComplete: number | null;
}

export interface ParsedProjectSheet {
  sheetName: string;
  snapshotDate: string | null;
  projectName: string;
  tasks: ParsedProjectTask[];
}

export function parseProjectSheet(sheet: ExcelJS.Worksheet): ParsedProjectSheet {
  const snapshotDate = parseSnapshotDateFromSheetName(sheet.name);
  const headerRow = findHeaderRow(sheet, ['TAREFA']) ?? findHeaderRow(sheet, ['TASK']);
  const projectName = extractProjectName(sheet) ?? 'BSC Printbag';
  const tasks: ParsedProjectTask[] = [];
  if (!headerRow) {
    return { sheetName: sheet.name, snapshotDate, projectName, tasks };
  }

  const headerMap = buildHeaderMap(sheet.getRow(headerRow));
  const wbsCol = findHeaderColumn(headerMap, [/WBS/, /ID TAREFA/]) ?? 1;
  const nameCol = findHeaderColumn(headerMap, [/NOME DA TAREFA/, /TASK NAME/, /TAREFA/, /^NOME$/]) ?? 2;
  const assigneeCol = findHeaderColumn(headerMap, [/ATRIBU/, /ASSIGNEE/, /RESPONSAVEL/]);
  const startCol = findHeaderColumn(headerMap, [/INICIO/, /^START$/]);
  const endCol = findHeaderColumn(headerMap, [/CONCLUIR/, /TERMINO/, /^FINISH$/]);
  const durationCol = findHeaderColumn(headerMap, [/DURACAO/, /DURATION/]);
  const bucketCol = findHeaderColumn(headerMap, [/BUCKET/, /PERSPECTIVA/, /CATEGORIA/]);
  const percentCol = findHeaderColumn(headerMap, [/% CONCLUIDA/, /% COMPLETE/, /PERCENT/]);

  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const name = String(getCellValue(sheet.getRow(rowIndex).getCell(nameCol)) ?? '').trim();
    if (!name) continue;
    const wbs = String(getCellValue(sheet.getRow(rowIndex).getCell(wbsCol)) ?? '').trim() || `ROW-${rowIndex}`;
    tasks.push({
      rowIndex,
      wbs,
      name,
      assignee: assigneeCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(assigneeCol)) ?? '').trim() || null : null,
      startDateIso: startCol ? parseDateFlexible(getCellValue(sheet.getRow(rowIndex).getCell(startCol))) : null,
      endDateIso: endCol ? parseDateFlexible(getCellValue(sheet.getRow(rowIndex).getCell(endCol))) : null,
      duration: durationCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(durationCol)) ?? '').trim() || null : null,
      bucket: bucketCol ? String(getCellValue(sheet.getRow(rowIndex).getCell(bucketCol)) ?? '').trim() || null : null,
      percentComplete: percentCol ? normalizePercent(getCellValue(sheet.getRow(rowIndex).getCell(percentCol))) : null,
    });
  }

  return { sheetName: sheet.name, snapshotDate, projectName, tasks };
}

function extractProjectName(sheet: ExcelJS.Worksheet): string | null {
  for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 12); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    for (let column = 1; column <= row.cellCount; column += 1) {
      const value = String(getCellValue(row.getCell(column)) ?? '').trim();
      if (!value) continue;
      const upper = toAsciiUpper(value);
      if (upper.startsWith('PROJECT:') || upper.startsWith('PROJETO:')) {
        return value.split(':').slice(1).join(':').trim();
      }
    }
  }
  return null;
}

