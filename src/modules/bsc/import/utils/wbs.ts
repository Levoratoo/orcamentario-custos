export function inferWbsLevel(wbs: string | null): number | null {
  if (!wbs) return null;
  const normalized = String(wbs).trim();
  if (!normalized) return null;
  return normalized.split('.').length;
}

export function inferParentWbs(wbs: string | null): string | null {
  if (!wbs) return null;
  const parts = String(wbs).trim().split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}
