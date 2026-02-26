export function calcDeltaPct(main: number, compare: number) {
  if (!compare) return null;
  return ((main - compare) / Math.max(Math.abs(compare), 1)) * 100;
}

export function monthLabels(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}/${year}`);
}
