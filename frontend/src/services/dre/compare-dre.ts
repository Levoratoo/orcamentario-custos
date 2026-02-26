import { formatCurrencyBRL } from '@/lib/formatters';
import { DreBySector, DreSummary } from '@/services/dre/types';

export interface DreDelta {
  abs: number;
  pct: number;
}

export function calcDelta(mainValue: number, compareValue: number): DreDelta {
  const abs = mainValue - compareValue;
  const base = Math.max(Math.abs(compareValue), 1);
  const pct = (abs / base) * 100;
  return { abs, pct };
}

export function formatDelta(delta: DreDelta, compareYear: number) {
  const sign = delta.abs >= 0 ? '+' : '';
  const pctSign = delta.pct >= 0 ? '+' : '';
  const label = `${sign}${formatCurrencyBRL(delta.abs)} (${pctSign}${delta.pct.toFixed(1)}%) vs ${compareYear}`;
  return label;
}

export function compareSummaries(main: DreSummary | null, compare: DreSummary | null) {
  return {
    totalAnual: calcDelta(main?.totalAnual ?? 0, compare?.totalAnual ?? 0),
    totalReceitas: calcDelta(main?.totalReceitas ?? 0, compare?.totalReceitas ?? 0),
    totalCustosDespesas: calcDelta(main?.totalCustosDespesas ?? 0, compare?.totalCustosDespesas ?? 0),
  };
}

export function compareSectorTotals(mainBySector: DreBySector[], compareBySector: DreBySector[]) {
  const compareMap = new Map(compareBySector.map((sector) => [sector.setorId, sector]));

  return new Map(
    mainBySector.map((sector) => {
      const compareSector = compareMap.get(sector.setorId);
      const delta = calcDelta(sector.total, compareSector?.total ?? 0);

      const compareAccounts = new Map(compareSector?.contas.map((row) => [row.id, row]) ?? []);
      const accountDeltas = new Map(
        sector.contas.map((row) => {
          const compareRow = compareAccounts.get(row.id);
          const mainTotal = Object.values(row.valoresPorMes).reduce((sum, value) => sum + value.previsto, 0);
          const compareTotal = compareRow
            ? Object.values(compareRow.valoresPorMes).reduce((sum, value) => sum + value.previsto, 0)
            : 0;
          return [row.id, calcDelta(mainTotal, compareTotal)] as const;
        }),
      );

      return [sector.setorId, { delta, accountDeltas }] as const;
    }),
  );
}
