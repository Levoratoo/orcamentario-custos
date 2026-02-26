import { PrismaClient, AccountPlanType } from '@prisma/client';
import * as XLSX from 'xlsx';

export interface AccountPlanRow {
  code: string;
  type: AccountPlanType;
  classification: string;
  description: string;
  level: number;
  line: number;
}

export interface ImportError {
  line: number;
  code?: string;
  message: string;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: ImportError[];
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function parseAccountPlanXlsx(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  const sheet = workbook.Sheets['Planilha1'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });

  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const value = normalizeValue(rows[i]?.[0]).toLowerCase();
    if (value === 'codigo' || value === 'código') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { rows: [] as AccountPlanRow[], errors: [{ line: 0, message: 'Cabecalho "Codigo" nao encontrado na coluna A.' }], headerRowIndex };
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const parsed: AccountPlanRow[] = [];
  const errors: ImportError[] = [];

  dataRows.forEach((row, index) => {
    const line = headerRowIndex + 2 + index;
    const code = normalizeValue(row?.[0]);
    const type = normalizeValue(row?.[1]).toUpperCase();
    const classification = normalizeValue(row?.[2]);
    const description = normalizeValue(row?.[3]);

    if (!code && !classification && !description) {
      return;
    }

    if (!code || !classification || !description) {
      errors.push({ line, code, message: 'Linha incompleta. Codigo, classificacao e descricao sao obrigatorios.' });
      return;
    }

    if (type !== 'T' && type !== 'A') {
      errors.push({ line, code, message: 'Tipo invalido. Use T ou A.' });
      return;
    }

    const level = classification.split('.').filter(Boolean).length;
    parsed.push({
      code,
      type: type as AccountPlanType,
      classification,
      description,
      level,
      line,
    });
  });

  return { rows: parsed, errors, headerRowIndex };
}

export async function importAccountPlanRows(prisma: PrismaClient, rows: AccountPlanRow[], existingErrors: ImportError[] = []): Promise<ImportSummary> {
  let inserted = 0;
  let updated = 0;
  const errors: ImportError[] = [...existingErrors];

  for (const row of rows) {
    try {
      const existing = await prisma.accountPlan.findUnique({ where: { code: row.code } });
      if (existing) {
        await prisma.accountPlan.update({
          where: { id: existing.id },
          data: {
            type: row.type,
            classification: row.classification,
            description: row.description,
            level: row.level,
            isAtiva: true,
          },
        });
        updated += 1;
      } else {
        await prisma.accountPlan.create({
          data: {
            code: row.code,
            type: row.type,
            classification: row.classification,
            description: row.description,
            level: row.level,
            isAtiva: true,
          },
        });
        inserted += 1;
      }
    } catch (error: unknown) {
      errors.push({ line: row.line, code: row.code, message: (error as Error).message });
    }
  }

  const classifications = rows.map((row) => row.classification);
  const plans = await prisma.accountPlan.findMany({ where: { classification: { in: classifications } } });
  const planByClassification = new Map(plans.map((plan) => [plan.classification, plan.id]));

  await Promise.all(
    rows.map(async (row) => {
      const parentClass = row.classification.split('.').slice(0, -1).join('.');
      const parentId = parentClass ? planByClassification.get(parentClass) : null;

      try {
        await prisma.accountPlan.updateMany({
          where: { code: row.code },
          data: { parentId: parentId ?? null },
        });
      } catch (error: unknown) {
        errors.push({ line: row.line, code: row.code, message: (error as Error).message });
      }
    }),
  );

  return {
    total: rows.length,
    inserted,
    updated,
    errors,
  };
}
