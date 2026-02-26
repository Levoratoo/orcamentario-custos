import { createHash } from 'crypto';

export function toAsciiUpper(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function slugify(value: unknown): string {
  return toAsciiUpper(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function fileSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function parseNumberFlexible(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace('%', '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseIndicatorCodeAndName(raw: string): { code: string | null; name: string | null } {
  const text = String(raw ?? '').trim();
  if (!text) return { code: null, name: null };
  const match = text.match(/^([FCPA]\d+(?:\.\d+){0,2})\s*[-–:]?\s*(.*)$/i);
  if (!match) return { code: null, name: text || null };
  return { code: match[1].toUpperCase(), name: match[2]?.trim() || null };
}

