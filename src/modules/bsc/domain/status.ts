export type KpiStatus = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';

export function computeStatus(
  target: number | null,
  actual: number | null,
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' = 'HIGHER_IS_BETTER',
) {
  if (target === null || actual === null) {
    return { attainment: null as number | null, status: 'NO_DATA' as KpiStatus };
  }
  if (direction === 'HIGHER_IS_BETTER' && target === 0) {
    return { attainment: null as number | null, status: 'NO_DATA' as KpiStatus };
  }
  if (direction === 'LOWER_IS_BETTER' && actual === 0) {
    return { attainment: null as number | null, status: 'NO_DATA' as KpiStatus };
  }
  const attainment = direction === 'LOWER_IS_BETTER' ? target / actual : actual / target;
  if (attainment >= 1) return { attainment, status: 'GREEN' as KpiStatus };
  if (attainment >= 0.9) return { attainment, status: 'YELLOW' as KpiStatus };
  return { attainment, status: 'RED' as KpiStatus };
}
