import { formatCurrencyBRL } from '@/lib/formatters';

export function formatCurrency(value: number | null | undefined) {
  return formatCurrencyBRL(value ?? 0);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}

export function formatDeltaValue(abs: number, pct: number, compareYear: number) {
  const sign = abs >= 0 ? '+' : '';
  const pctSign = pct >= 0 ? '+' : '';
  return `${sign}${formatCurrency(abs)} (${pctSign}${pct.toFixed(1)}%) vs ${compareYear}`;
}
