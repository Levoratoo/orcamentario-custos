import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizeDreKey } from './dre-utils';

type ImportSummary = {
  year: number;
  sourceFile: string;
  rows: number;
  totalAnnual: number;
  totalsByMonth: Record<number, number>;
};

function extractAccountCode(rawLabel: string) {
  const label = rawLabel.replace(/\s+/g, ' ').trim();
  const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
  return match?.[1] ?? normalizeDreKey(label);
}

export async function importRealizadoBaseline2026(
  prisma: PrismaClient,
  filePath: string,
): Promise<ImportSummary> {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true }) as Array<Array<any>>;
  const header = rows[0] ?? [];

  const monthColumns = header
    .map((label: string, index: number) => {
      const text = String(label ?? '');
      if (!text) return null;
      if (!text.toLowerCase().includes('realizado')) return null;
      const match = text.match(/(\d{2})\/(\d{4})/);
      if (!match) return null;
      return { index, month: Number(match[1]), year: Number(match[2]) };
    })
    .filter(Boolean) as Array<{ index: number; month: number; year: number }>;

  const year = 2026;
  const dataMap = new Map<string, { year: number; month: number; accountCode: string; value: number; sourceFile: string }>();
  const totalsByMonth: Record<number, number> = {};
  monthColumns.forEach((col) => {
    if (col.year === year) totalsByMonth[col.month] = 0;
  });

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rawLabel = String(row[0] ?? '').trim();
    if (!rawLabel) continue;
    const accountCode = extractAccountCode(rawLabel);

    for (const col of monthColumns) {
      if (col.year !== year) continue;
      const rawValue = row[col.index];
      const value = Number(rawValue ?? 0) || 0;
      totalsByMonth[col.month] = (totalsByMonth[col.month] ?? 0) + value;
      const key = `${year}-${col.month}-${accountCode}`;
      const existing = dataMap.get(key);
      if (existing) {
        existing.value += value;
      } else {
        dataMap.set(key, { year, month: col.month, accountCode, value, sourceFile: path.basename(filePath) });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.realizedValue.deleteMany({ where: { year } });
    if (dataMap.size > 0) {
      await tx.realizedValue.createMany({ data: Array.from(dataMap.values()) });
    }
  });

  const totalAnnual = Object.values(totalsByMonth).reduce((sum, value) => sum + value, 0);
  return {
    year,
    sourceFile: path.basename(filePath),
    rows: dataMap.size,
    totalAnnual,
    totalsByMonth,
  };
}

export function resolveRealizadoBaselineFile() {
  const root = path.resolve(__dirname, '..', '..');
  const candidates = fs.readdirSync(root);
  const file =
    candidates.find((name) => name.toLowerCase().includes('dre 2026') && name.toLowerCase().includes('orçado')) ??
    candidates.find((name) => name.toLowerCase().includes('dre 2026'));
  if (!file) return null;
  return path.join(root, file);
}
