import * as ExcelJS from 'exceljs';
import { parseSnapshotDateFromSheetName } from '../utils/date';
import { toAsciiUpper } from '../utils/normalize';

export interface WorkbookSheetGroups {
  mapa?: ExcelJS.Worksheet;
  gestao?: ExcelJS.Worksheet;
  indicatorSheets: ExcelJS.Worksheet[];
  projectSheets: Array<{ sheet: ExcelJS.Worksheet; snapshotDate: string | null }>;
  baseSheet?: ExcelJS.Worksheet;
  tabSheet?: ExcelJS.Worksheet;
}

export function parseWorkbookSheets(workbook: ExcelJS.Workbook): WorkbookSheetGroups {
  const groups: WorkbookSheetGroups = {
    indicatorSheets: [],
    projectSheets: [],
  };

  for (const sheet of workbook.worksheets) {
    const name = toAsciiUpper(sheet.name);
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
        snapshotDate: parseSnapshotDateFromSheetName(sheet.name),
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

