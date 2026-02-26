import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import { DreMode } from '@prisma/client';

export interface ParsedDreRow {
  label: string;
  level: number;
  values: number[];
}

export interface ParsedDreColumn {
  label: string;
  kind: string;
  month: number | null;
  mode: DreMode;
}

export interface ParsedDreFile {
  columns: ParsedDreColumn[];
  rows: ParsedDreRow[];
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function inferLevel(label: string) {
  const match = label.match(/^(\s+)/);
  if (!match) return 0;
  return Math.max(0, Math.floor(match[1].length / 2));
}

function parseMonth(label: string) {
  const parts = label.split('/');
  if (parts.length < 2) return null;
  const month = Number(parts[0]);
  if (!Number.isFinite(month)) return null;
  return month;
}

function parseKind(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('real')) return DreMode.REALIZADO;
  return DreMode.PREVISTO;
}

function buildColumns(header: string[], kindRow?: string[]) {
  let currentLabel = '';
  return header.map((cell, index) => {
    const label = normalizeCell(cell);
    if (label) {
      currentLabel = label;
    }
    const kind = normalizeCell(kindRow?.[index] ?? '');
    const monthLabel = currentLabel;
    const month = monthLabel === 'Total' ? null : parseMonth(monthLabel);
    return {
      label: monthLabel,
      kind: kind || 'Previsto',
      month,
      mode: parseKind(kind || monthLabel),
    };
  });
}

export function parseDreFile(buffer: Buffer, fileName: string): ParsedDreFile {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const csvText = buffer.toString('utf8');
    const records = parse(csvText, { relax_column_count: true });
    return parseFromRows(records);
  }

  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  return parseFromRows(rows);
}

function parseFromRows(rows: string[][]): ParsedDreFile {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeCell(cell).toLowerCase().includes('conta')),
  );
  if (headerIndex === -1) {
    throw new Error('Cabecalho de contas nao encontrado.');
  }
  const headerRow = rows[headerIndex];
  const kindRow = rows[headerIndex + 1]?.some((cell) => /previsto|realizado/i.test(normalizeCell(cell)))
    ? rows[headerIndex + 1]
    : undefined;
  const dataStart = kindRow ? headerIndex + 2 : headerIndex + 1;

  const columns = buildColumns(headerRow.slice(1), kindRow?.slice(1));
  const parsedRows: ParsedDreRow[] = [];

  for (let i = dataStart; i < rows.length; i += 1) {
    const row = rows[i];
    const label = normalizeCell(row?.[0]);
    if (!label) continue;
    const level = inferLevel(label);
    const values = row.slice(1).map((cell) => {
      const num = Number(String(cell).replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(num) ? num : 0;
    });
    parsedRows.push({ label, level, values });
  }

  return { columns, rows: parsedRows };
}
