import { useMemo } from 'react';
import { useDre } from '@/hooks/use-dre';
import { mapDashboardData, DashboardModel, DashboardPeriodMode } from '@/lib/dashboardMapper';
import { mergeProjected } from '@/services/dre/merge-projected';

export function useDashboardData(
  budgetId: string | null,
  compareBudgetId: string | null,
  year: number,
  mode: 'previsto' | 'realizado' | 'projetado',
  actualBudgetId?: string | null,
  compareActualBudgetId?: string | null,
  periodMode: DashboardPeriodMode = 'annual',
  selectedMonth = 1,
  cutoffMonth = 12,
) {
  const isProjetado = mode === 'projetado';
  const mainPrevisto = useDre({ budgetId: isProjetado ? budgetId : null, mode: 'previsto', actualBudgetId });
  const mainRealizado = useDre({ budgetId: isProjetado ? budgetId : null, mode: 'realizado', actualBudgetId });
  const mainMode = useDre({ budgetId, mode: isProjetado ? 'previsto' : mode, actualBudgetId });
  const mainClosingMonth = mainPrevisto.closingMonth ?? mainRealizado.closingMonth ?? 0;

  const mainProjected = useMemo(() => {
    if (!mainPrevisto.summary || !mainRealizado.summary) return null;
    return mergeProjected(
      { rows: mainPrevisto.rows, summary: mainPrevisto.summary, bySector: mainPrevisto.bySector, months: mainPrevisto.months },
      { rows: mainRealizado.rows, summary: mainRealizado.summary, bySector: mainRealizado.bySector, months: mainRealizado.months },
      mainClosingMonth,
    );
  }, [
    mainPrevisto.rows,
    mainPrevisto.summary,
    mainPrevisto.bySector,
    mainPrevisto.months,
    mainRealizado.rows,
    mainRealizado.summary,
    mainRealizado.bySector,
    mainRealizado.months,
    mainClosingMonth,
  ]);

  const main = mode === 'projetado' && mainProjected ? { ...mainPrevisto, ...mainProjected } : mainMode;

  const comparePrevisto = useDre({
    budgetId: isProjetado ? compareBudgetId : null,
    mode: 'previsto',
    actualBudgetId: compareActualBudgetId,
  });
  const compareRealizado = useDre({
    budgetId: isProjetado ? compareBudgetId : null,
    mode: 'realizado',
    actualBudgetId: compareActualBudgetId,
  });
  const compareMode = useDre({
    budgetId: compareBudgetId,
    mode: isProjetado ? 'previsto' : mode,
    actualBudgetId: compareActualBudgetId,
  });
  const compareClosingMonth = comparePrevisto.closingMonth ?? compareRealizado.closingMonth ?? 0;

  const compareProjected = useMemo(() => {
    if (!comparePrevisto.summary || !compareRealizado.summary) return null;
    return mergeProjected(
      {
        rows: comparePrevisto.rows,
        summary: comparePrevisto.summary,
        bySector: comparePrevisto.bySector,
        months: comparePrevisto.months,
      },
      {
        rows: compareRealizado.rows,
        summary: compareRealizado.summary,
        bySector: compareRealizado.bySector,
        months: compareRealizado.months,
      },
      compareClosingMonth,
    );
  }, [
    comparePrevisto.rows,
    comparePrevisto.summary,
    comparePrevisto.bySector,
    comparePrevisto.months,
    compareRealizado.rows,
    compareRealizado.summary,
    compareRealizado.bySector,
    compareRealizado.months,
    compareClosingMonth,
  ]);

  const compare = mode === 'projetado' && compareProjected ? { ...comparePrevisto, ...compareProjected } : compareMode;

  const model = useMemo<DashboardModel | null>(() => {
    if (!main.summary || main.rows.length === 0) return null;
    const compareData = compare.rows.length > 0 ? compare : null;
    return mapDashboardData(
      {
        rows: main.rows,
        summary: main.summary,
        months: main.months,
        bySector: main.bySector,
      },
      compareData
        ? {
            rows: compare.rows,
            summary: compare.summary!,
            months: compare.months,
            bySector: compare.bySector,
          }
        : null,
      year,
      mode,
      { periodMode, selectedMonth, cutoffMonth },
    );
  }, [
    main.rows,
    main.summary,
    main.months,
    main.bySector,
    compare.rows,
    compare.summary,
    compare.months,
    compare.bySector,
    year,
    mode,
    periodMode,
    selectedMonth,
    cutoffMonth,
  ]);

  return {
    model,
    loading:
      mainPrevisto.loading ||
      mainRealizado.loading ||
      comparePrevisto.loading ||
      compareRealizado.loading ||
      mainMode.loading ||
      compareMode.loading,
    error:
      mainPrevisto.error ||
      mainRealizado.error ||
      comparePrevisto.error ||
      compareRealizado.error ||
      mainMode.error ||
      compareMode.error,
    main,
    compare,
  };
}
