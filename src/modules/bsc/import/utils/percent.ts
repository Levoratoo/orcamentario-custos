import { parseNumberFlexible } from './normalize';

export function normalizePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (value > 1) return value / 100;
    return value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = parseNumberFlexible(raw);
  if (numeric === null) return null;
  if (raw.includes('%') || numeric > 1) return numeric / 100;
  return numeric;
}

