export const monthKeys = ['01','02','03','04','05','06','07','08','09','10','11','12'] as const;
export type MonthKey = typeof monthKeys[number];

export function formatCurrencyBRL(
  value: number | null | undefined,
  options?: { negativeStyle?: 'minus' | 'parentheses' },
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const absValue = Math.abs(value);
  const formatted = formatter.format(absValue);
  if (value < 0) {
    if (options?.negativeStyle === 'parentheses') {
      return `(${formatted})`;
    }
    return `-${formatted}`;
  }
  return formatted;
}

export function parseDecimal(value: string) {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumMonthlyValues(values: Record<string, string>) {
  return monthKeys.reduce((sum, key) => sum + parseDecimal(values[key] ?? '0'), 0);
}

export function normalizeMonthly(values?: Record<string, string>) {
  const next: Record<string, string> = {};
  monthKeys.forEach((key) => {
    next[key] = values?.[key] ?? '0.00';
  });
  return next;
}
