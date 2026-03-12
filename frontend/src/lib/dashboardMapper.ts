import { DreResult, DreRow } from '@/services/dre/types';

export type DashboardSeriesPoint = { month: string; value: number };
export type DashboardPeriodMode = 'monthly' | 'annual';

export type DashboardKpi = {
  key: string;
  label: string;
  value: number;
  yoyValue: number | null;
  yoyPct: number | null;
  series: DashboardSeriesPoint[];
};

export type DashboardModel = {
  year: number;
  kpis: DashboardKpi[];
  volatility: {
    series: DashboardSeriesPoint[];
    best: DashboardSeriesPoint | null;
    worst: DashboardSeriesPoint | null;
  };
  topCostCenters: { name: string; value: number }[];
  topAccounts: { name: string; value: number }[];
  topGains: { name: string; value: number }[];
  topLosses: { name: string; value: number }[];
  accountTree: TreeNode[];
};

export type TreeNode = {
  id: string;
  name: string;
  value: number;
  children?: TreeNode[];
  hasChildren?: boolean;
};

type DashboardMapOptions = {
  periodMode?: DashboardPeriodMode;
  cutoffMonth?: number;
  selectedMonth?: number;
};

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isCatalogLabel(value: string) {
  return normalizeLabel(value).includes('CATALOGOS');
}

function monthNumberFromKey(monthKey: string) {
  return Number(monthKey.split('-')[1] ?? 0);
}

function includeByPeriod(
  monthKey: string,
  periodMode: DashboardPeriodMode,
  selectedMonth: number,
  cutoffMonth: number,
) {
  const month = monthNumberFromKey(monthKey);
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (periodMode === 'monthly') return month === selectedMonth;
  return month <= cutoffMonth;
}

function monthValueForMode(
  value: DreRow['valoresPorMes'][string] | undefined,
  mode: 'previsto' | 'realizado' | 'projetado',
) {
  if (!value) return 0;
  if (mode === 'projetado') return value.projetado ?? value.previsto ?? 0;
  return value[mode] ?? 0;
}

function seriesFromRow(
  row: DreRow | undefined,
  months: string[],
  mode: 'previsto' | 'realizado' | 'projetado',
) {
  if (!row) return months.map((month) => ({ month, value: 0 }));
  return months.map((month) => ({
    month,
    value: monthValueForMode(row.valoresPorMes[month], mode),
  }));
}

function totalFromRow(
  row: DreRow | undefined,
  mode: 'previsto' | 'realizado' | 'projetado',
  periodMode: DashboardPeriodMode,
  selectedMonth: number,
  cutoffMonth: number,
) {
  if (!row) return 0;
  return Object.entries(row.valoresPorMes).reduce((sum, [monthKey, value]) => {
    if (!includeByPeriod(monthKey, periodMode, selectedMonth, cutoffMonth)) return sum;
    return sum + monthValueForMode(value, mode);
  }, 0);
}

function calcDelta(mainValue: number, compareValue: number) {
  const abs = mainValue - compareValue;
  const base = Math.max(Math.abs(compareValue), 1);
  const pct = (abs / base) * 100;
  return { abs, pct };
}

function findRowByLabel(rows: DreRow[], label: string) {
  const target = normalizeLabel(label);
  return rows.find((row) => normalizeLabel(row.descricao).includes(target));
}

function buildTree(
  rows: DreRow[],
  mode: 'previsto' | 'realizado' | 'projetado',
  periodMode: DashboardPeriodMode,
  selectedMonth: number,
  cutoffMonth: number,
) {
  const nodes = new Map<string, TreeNode>();
  const childrenByParent = new Map<string | null, TreeNode[]>();

  rows.forEach((row) => {
    const value = totalFromRow(row, mode, periodMode, selectedMonth, cutoffMonth);
    const node: TreeNode = { id: row.id, name: row.descricao, value };
    nodes.set(row.id, node);
    const parentId = row.parentId ?? null;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(node);
    childrenByParent.set(parentId, list);
  });

  nodes.forEach((node, id) => {
    const children = childrenByParent.get(id);
    if (children && children.length > 0) {
      node.children = children;
      node.hasChildren = true;
    }
  });

  return childrenByParent.get(null) ?? [];
}

export function mapDashboardData(
  main: DreResult,
  compare: DreResult | null,
  year: number,
  mode: 'previsto' | 'realizado' | 'projetado' = 'previsto',
  options?: DashboardMapOptions,
): DashboardModel {
  const months = main.months;
  const compareRows = compare?.rows ?? [];
  const periodMode = options?.periodMode ?? 'annual';
  const selectedMonth = Math.max(1, Math.min(12, options?.selectedMonth ?? 1));
  const cutoffMonth = Math.max(1, Math.min(12, options?.cutoffMonth ?? 12));

  const receitaBruta = findRowByLabel(main.rows, 'RECEITA BRUTA');
  const receitaLiquida = findRowByLabel(main.rows, 'RECEITA LIQUIDA');
  const lucroLiquido = findRowByLabel(main.rows, 'LUCRO LIQUIDO');
  const ebitda = findRowByLabel(main.rows, 'EBITDA');
  const custosDespesas = findRowByLabel(main.rows, 'CUSTOS E DESPESAS');

  const receitaBrutaCompare = compare ? findRowByLabel(compareRows, 'RECEITA BRUTA') : undefined;
  const receitaLiquidaCompare = compare ? findRowByLabel(compareRows, 'RECEITA LIQUIDA') : undefined;
  const lucroLiquidoCompare = compare ? findRowByLabel(compareRows, 'LUCRO LIQUIDO') : undefined;
  const ebitdaCompare = compare ? findRowByLabel(compareRows, 'EBITDA') : undefined;
  const custosDespesasCompare = compare ? findRowByLabel(compareRows, 'CUSTOS E DESPESAS') : undefined;

  const resolveTotal = (row: DreRow | undefined) =>
    totalFromRow(row, mode, periodMode, selectedMonth, cutoffMonth);

  const kpis: DashboardKpi[] = [
    {
      key: 'receita-bruta',
      label: 'Faturamento',
      value: resolveTotal(receitaBruta),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(resolveTotal(receitaBruta), resolveTotal(receitaBrutaCompare));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(receitaBruta, months, mode),
    },
    {
      key: 'ebitda',
      label: 'EBITDA',
      value: resolveTotal(ebitda),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(resolveTotal(ebitda), resolveTotal(ebitdaCompare));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(ebitda, months, mode),
    },
    {
      key: 'lucro-liquido',
      label: 'Lucro liquido',
      value: resolveTotal(lucroLiquido),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(resolveTotal(lucroLiquido), resolveTotal(lucroLiquidoCompare));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(lucroLiquido, months, mode),
    },
    {
      key: 'receita-liquida',
      label: 'Receita liquida',
      value: resolveTotal(receitaLiquida),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(resolveTotal(receitaLiquida), resolveTotal(receitaLiquidaCompare));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(receitaLiquida, months, mode),
    },
    {
      key: 'custos-despesas',
      label: 'Custos/Despesas operacionais',
      value: resolveTotal(custosDespesas),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(resolveTotal(custosDespesas), resolveTotal(custosDespesasCompare));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(custosDespesas, months, mode),
    },
  ];

  const rootRows = main.rows.filter((row) => !row.parentId);
  const volatilitySeries = months.map((month) => ({
    month,
    value: rootRows.reduce((sum, row) => sum + monthValueForMode(row.valoresPorMes[month], mode), 0),
  }));

  const best = volatilitySeries.length
    ? volatilitySeries.reduce((acc, item) => (item.value > acc.value ? item : acc), volatilitySeries[0])
    : null;
  const worst = volatilitySeries.length
    ? volatilitySeries.reduce((acc, item) => (item.value < acc.value ? item : acc), volatilitySeries[0])
    : null;

  const rowTotal = (row: DreRow) => resolveTotal(row);

  const topGroups = main.rows
    .filter((row) => row.nivel <= 1)
    .map((row) => ({ name: row.descricao, value: rowTotal(row) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topAccounts = main.rows
    .filter((row) => row.nivel >= 2)
    .map((row) => ({ name: row.descricao, value: rowTotal(row) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const rowById = new Map(main.rows.map((row) => [row.id, row] as const));
  const gainsByParent = new Map<string, number>();
  main.rows
    .filter((row) => row.nivel >= 2)
    .forEach((row) => {
      const value = rowTotal(row);
      if (value <= 0) return;
      if (isCatalogLabel(row.descricao)) return;
      const parent = row.parentId ? rowById.get(row.parentId) : undefined;
      const parentName = parent?.descricao ?? row.descricao;
      if (isCatalogLabel(parentName)) return;
      gainsByParent.set(parentName, (gainsByParent.get(parentName) ?? 0) + value);
    });

  const topGains = Array.from(gainsByParent.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topLosses = main.rows
    .filter((row) => row.nivel >= 2)
    .map((row) => ({ name: row.descricao, value: rowTotal(row) }))
    .filter((item) => item.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  return {
    year,
    kpis,
    volatility: {
      series: volatilitySeries,
      best,
      worst,
    },
    topCostCenters: topGroups,
    topAccounts,
    topGains,
    topLosses,
    accountTree: buildTree(main.rows, mode, periodMode, selectedMonth, cutoffMonth),
  };
}
