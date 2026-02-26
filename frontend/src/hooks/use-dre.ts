import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { normalizeDreTree } from '@/services/dre/normalize-dre';
import { DreMode, DreResult } from '@/services/dre/types';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';

interface UseDreParams {
  budgetId?: string | null;
  mode?: DreMode;
  actualBudgetId?: string | null;
}

export function useDre({ budgetId, mode = 'previsto', actualBudgetId }: UseDreParams) {
  const { apiFetch } = useApiClient();
  const query = useQuery({
    queryKey: ['dre', budgetId, mode, actualBudgetId],
    enabled: Boolean(budgetId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: () => {
      const modeParam =
        mode === 'dre' ? 'DRE' : mode === 'realizado' ? 'ACTUAL' : mode === 'projetado' ? 'PROJECTED' : 'BUDGET';
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DRE] request', { budgetId, mode: modeParam, actualBudgetId });
      }
      return backend.getDreTree(apiFetch, budgetId!, modeParam, actualBudgetId ?? undefined);
    },
  });

  const normalized = useMemo(() => {
    if (!query.data) return null;
    const rows = query.data.rows.map((row) => ({
      ...row,
      codigo: row.codigo ?? undefined,
      valoresPorMes: Object.fromEntries(
        Object.entries(row.valoresPorMes ?? {}).map(([monthKey, values]) => [
          monthKey,
          {
            previsto: Number(values?.previsto ?? 0),
            realizado: Number(values?.realizado ?? 0),
            projetado: Number(values?.projetado ?? 0),
          },
        ]),
      ),
    }));
    return normalizeDreTree({ rows, months: query.data.months }, mode);
  }, [query.data, mode]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!query.data) return;
    console.debug('[DRE] response', {
      mode,
      rows: query.data.rows.length,
      months: query.data.months.length,
    });
  }, [query.data, mode]);

  return {
    rows: normalized?.rows ?? ([] as DreResult['rows']),
    summary: normalized?.summary ?? null,
    bySector: normalized?.bySector ?? [],
    months: normalized?.months ?? [],
    loading: query.isLoading,
    error: query.error,
    year: query.data?.year ?? null,
    closingMonth: query.data?.closingMonth ?? null,
  };
}
