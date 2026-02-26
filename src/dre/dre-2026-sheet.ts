import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { Logger } from '@nestjs/common';
import { normalizeDreKey, sanitizeLabel } from './dre-utils';

type MonthCell = { previsto: number; realizado: number };
type MonthMap = Map<number, MonthCell>;

export type Dre2026SheetEntry = {
  code: string | null;
  label: string;
  labelKey: string;
  rank: number;
  months: MonthMap;
};

type Dre2026SheetData = {
  sourceFile: string;
  entries: Dre2026SheetEntry[];
};

let cached: Dre2026SheetData | null = null;
let loaded = false;

export function invalidateDre2026SheetCache() {
  cached = null;
  loaded = false;
}

function findSheetFile(rootDir: string) {
  const normalizeFileName = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const candidates = fs
    .readdirSync(rootDir)
    .filter((name) => name.toLowerCase().endsWith('.xlsx'))
    .map((name) => ({ name, key: normalizeFileName(name) }));

  const pick = (predicate: (key: string) => boolean) => candidates.find((item) => predicate(item.key))?.name;
  const preferred =
    pick((key) => key.includes('dados dre') && key.includes('realizado')) ??
    pick((key) => key.includes('dados') && key.includes('dre') && key.includes('realizado')) ??
    pick((key) => key.includes('dre expandida')) ??
    pick((key) => key.includes('dre recolhida')) ??
    pick((key) => key.includes('dre 2026') && key.includes('orcado')) ??
    pick((key) => key.includes('dre 2026')) ??
    candidates.find((item) => item.key.includes('dre'))?.name;
  return preferred ? path.join(rootDir, preferred) : null;
}

function extractMonthColumns(header: Array<unknown>) {
  const monthCols: Array<{ index: number; month: number; year: number; kind: 'PREVISTO' | 'REALIZADO' }> = [];
  header.forEach((col, index) => {
    const text = sanitizeLabel(String(col ?? ''));
    const match = text.match(/^(\d{2})\/(\d{4})\((Previsto|Realizado)\)$/i);
    if (!match) return;
    monthCols.push({
      index,
      month: Number(match[1]),
      year: Number(match[2]),
      kind: match[3].toUpperCase() as 'PREVISTO' | 'REALIZADO',
    });
  });
  return monthCols;
}

function ensureMonth(map: MonthMap, month: number) {
  const existing = map.get(month);
  if (existing) return existing;
  const created = { previsto: 0, realizado: 0 };
  map.set(month, created);
  return created;
}

export function getDre2026SheetData(logger?: Logger) {
  if (loaded) return cached;
  loaded = true;

  try {
    const root = path.resolve(process.cwd());
    const filePath = findSheetFile(root);
    if (!filePath || !fs.existsSync(filePath)) {
      logger?.warn('DRE 2026 sheet not found. Sheet override disabled.');
      cached = null;
      return null;
    }

    const workbook = xlsx.readFile(filePath);
    const normalizedSheetName = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    let selectedSheetName: string | null = null;
    let selectedRows: Array<Array<unknown>> = [];
    let selectedMonthCols: Array<{ index: number; month: number; year: number; kind: 'PREVISTO' | 'REALIZADO' }> = [];
    let bestScore = -1;

    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return;
      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as Array<Array<unknown>>;
      const header = rows[0] ?? [];
      const monthCols = extractMonthColumns(header);
      const monthCols2026 = monthCols.filter((col) => col.year === 2026);
      if (monthCols2026.length === 0) return;

      const normalized = normalizedSheetName(sheetName);
      const sheetBonus = normalized.includes('2026 mensal') ? 1000 : 0;
      const score = sheetBonus + monthCols2026.length;
      if (score > bestScore) {
        bestScore = score;
        selectedSheetName = sheetName;
        selectedRows = rows;
        selectedMonthCols = monthCols2026;
      }
    });

    if (!selectedSheetName || selectedMonthCols.length === 0) {
      logger?.warn(`DRE 2026 sheet '${path.basename(filePath)}' has no valid MM/YYYY(Previsto|Realizado) columns for 2026.`);
      cached = null;
      return null;
    }

    const rows = selectedRows;
    const monthCols = selectedMonthCols;

    const entries: Dre2026SheetEntry[] = [];
    let rank = 0;

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const rawLabel = sanitizeLabel(String(row[0] ?? ''));
      if (!rawLabel) continue;

      const codeMatch = rawLabel.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
      const code = codeMatch?.[1]?.trim() ?? null;
      const label = sanitizeLabel(codeMatch?.[2] ?? rawLabel);
      const labelKey = normalizeDreKey(label);

      const keyMap: MonthMap = new Map<number, MonthCell>();

      monthCols.forEach((col) => {
        if (col.year !== 2026) return;
        const value = Number(row[col.index] ?? 0) || 0;
        const monthCell = ensureMonth(keyMap, col.month);
        if (col.kind === 'PREVISTO') monthCell.previsto = value;
        else monthCell.realizado = value;
      });

      entries.push({
        code,
        label,
        labelKey,
        rank,
        months: keyMap,
      });
      rank += 1;
    }

    cached = {
      sourceFile: path.basename(filePath),
      entries,
    };
    logger?.log(`DRE 2026 sheet override loaded from ${cached.sourceFile} [sheet: ${selectedSheetName}].`);
    return cached;
  } catch (error) {
    logger?.warn(`Failed loading DRE 2026 sheet override: ${(error as Error).message}`);
    cached = null;
    return null;
  }
}
