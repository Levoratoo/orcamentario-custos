import * as xlsx from 'xlsx';

export const IMPORT_SOURCE_2026 = 'IMPORT_XLSX_PRO_ACAO_2026';

export interface Budget2026NormalizedRow {
  rowNumber: number;
  coordinator: string;
  ctaProAcao: string;
  accountLabel: string;
  setor: string;
  detailLabel: string | null;
  scenario: string;
  months: Array<{ month: number; value: number }>;
  totalProvided: number | null;
  accountPathId: string;
  parentPathId: string | null;
}

export interface Budget2026PreviewResult {
  year: number;
  rows: Budget2026NormalizedRow[];
  summary: {
    totalRows: number;
    coordinators: number;
    newParentAccounts: number;
    newChildAccounts: number;
    monthlyEntries: number;
  };
  sample: Budget2026NormalizedRow[];
  newAccounts: Array<{ pathId: string; parentPathId: string | null; label: string; level: number }>;
  warnings: Array<{ rowNumber: number; message: string }>;
  errors: Array<{ rowNumber: number; message: string }>;
}

const REQUIRED_COLUMNS = [
  'padrinho',
  'cta pro acao',
  'conta contabil',
  'setor',
  'cenarios',
];

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'sem-nome';
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonthHeader(value: string): number | null {
  const match = value.match(/^(\d{2})[/\s](\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (year !== 2026) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function findHeader(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i] ?? [];
    const normalized = row.map((cell) => normalizeHeader(cell));

    const headerMap = new Map<string, number>();
    normalized.forEach((cell, idx) => {
      if (cell) {
        headerMap.set(cell, idx);
      }
    });

    const monthColumns: Array<{ month: number; index: number }> = [];
    normalized.forEach((cell, idx) => {
      const month = parseMonthHeader(cell);
      if (month) monthColumns.push({ month, index: idx });
    });

    const hasRequired = REQUIRED_COLUMNS.every((column) => headerMap.has(column));
    if (hasRequired && monthColumns.length > 0) {
      return {
        rowIndex: i,
        headerMap,
        monthColumns: monthColumns.sort((a, b) => a.month - b.month),
      };
    }
  }
  return null;
}

export function parseBudget2026CoordinatorWorkbook(buffer: Buffer): Budget2026PreviewResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const rowsOut: Budget2026NormalizedRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];
  const warnings: Array<{ rowNumber: number; message: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const header = findHeader(rawRows);
    if (!header) continue;

    const getValue = (row: unknown[], key: string) => row[header.headerMap.get(key) ?? -1];
    const totalColumnIndex = Array.from(header.headerMap.entries()).find(([label]) => label === 'total')?.[1] ?? -1;

    for (let rowIndex = header.rowIndex + 1; rowIndex < rawRows.length; rowIndex += 1) {
      const row = rawRows[rowIndex] ?? [];
      const rowNumber = rowIndex + 1;

      const coordinator = normalizeText(getValue(row, 'padrinho'));
      const ctaProAcao = normalizeText(getValue(row, 'cta pro acao'));
      const accountLabel = normalizeText(getValue(row, 'conta contabil'));
      const setor = normalizeText(getValue(row, 'setor'));
      const detailRaw = normalizeText(getValue(row, 'detalhamento item') || getValue(row, 'detalhamento'));
      const scenario = normalizeText(getValue(row, 'cenarios'));

      const hasAny = coordinator || ctaProAcao || accountLabel || setor || detailRaw || scenario;
      if (!hasAny) continue;

      if (!coordinator || !accountLabel || !scenario) {
        errors.push({ rowNumber, message: 'Colunas obrigatorias faltando (Padrinho, Conta Contabil ou Cenarios).' });
        continue;
      }

      const months: Array<{ month: number; value: number }> = [];
      for (const col of header.monthColumns) {
        const parsed = parseNumber(row[col.index]);
        if (parsed === null || Number.isNaN(parsed)) continue;
        if (parsed === 0) continue;
        months.push({ month: col.month, value: parsed });
      }

      const totalProvided = totalColumnIndex >= 0 ? parseNumber(row[totalColumnIndex]) : null;
      if (totalProvided !== null) {
        const generatedTotal = months.reduce((sum, month) => sum + month.value, 0);
        const diff = Math.abs(generatedTotal - totalProvided);
        if (diff > 0.01) {
          warnings.push({ rowNumber, message: `Total divergente. Total coluna=${totalProvided} vs soma meses=${generatedTotal}.` });
        }
      }

      const detailLabel = detailRaw || null;
      const parentPathId = slugify(accountLabel);
      const accountPathId = detailLabel ? `${parentPathId}/${slugify(detailLabel)}` : parentPathId;

      rowsOut.push({
        rowNumber,
        coordinator,
        ctaProAcao,
        accountLabel,
        setor,
        detailLabel,
        scenario,
        months,
        totalProvided,
        accountPathId,
        parentPathId: detailLabel ? parentPathId : null,
      });
    }
  }

  if (rowsOut.length === 0) {
    errors.push({ rowNumber: 0, message: 'Nenhuma linha valida encontrada na planilha.' });
  }

  const parentPaths = new Map<string, string>();
  const childPaths = new Map<string, string>();
  const coordinators = new Set<string>();
  let monthlyEntries = 0;

  for (const row of rowsOut) {
    coordinators.add(row.coordinator.toLowerCase());
    monthlyEntries += row.months.length;
    parentPaths.set(row.parentPathId ?? row.accountPathId, row.accountLabel);
    if (row.detailLabel) {
      childPaths.set(row.accountPathId, row.detailLabel);
    }
  }

  const newAccounts = [
    ...Array.from(parentPaths.entries()).map(([pathId, label]) => ({ pathId, parentPathId: null, label, level: 0 })),
    ...Array.from(childPaths.entries()).map(([pathId, label]) => ({
      pathId,
      parentPathId: pathId.split('/').slice(0, -1).join('/'),
      label,
      level: 1,
    })),
  ];

  return {
    year: 2026,
    rows: rowsOut,
    summary: {
      totalRows: rowsOut.length,
      coordinators: coordinators.size,
      newParentAccounts: parentPaths.size,
      newChildAccounts: childPaths.size,
      monthlyEntries,
    },
    sample: rowsOut.slice(0, 20),
    newAccounts,
    warnings,
    errors,
  };
}
