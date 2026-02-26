import { dreData } from '@/data/dre-data';

export function getDreRaw(year: number) {
  const key = String(year) as keyof typeof dreData;
  return dreData[key] ?? null;
}
