import { DreResult, DreRow } from '@/services/dre/types';

export type DashboardSeriesPoint = { month: string; value: number };

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

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function seriesFromRow(row: DreRow | undefined, months: string[], mode: 'previsto' | 'realizado' | 'projetado') {
  if (!row) return months.map((month) => ({ month, value: 0 }));
  return months.map((month) => ({
    month,
    value:
      mode === 'projetado'
        ? row.valoresPorMes[month]?.projetado ?? row.valoresPorMes[month]?.previsto ?? 0
        : row.valoresPorMes[month]?.[mode] ?? 0,
  }));
}

function totalFromRow(row: DreRow | undefined, mode: 'previsto' | 'realizado' | 'projetado') {
  if (!row) return 0;
  return Object.values(row.valoresPorMes).reduce((sum, value) => {
    const next = mode === 'projetado' ? value.projetado ?? value.previsto : value[mode];
    return sum + (next ?? 0);
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

function buildTree(rows: DreRow[], mode: 'previsto' | 'realizado' | 'projetado') {
  const nodes = new Map<string, TreeNode>();
  const childrenByParent = new Map<string | null, TreeNode[]>();

  rows.forEach((row) => {
    const value = totalFromRow(row, mode);
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
): DashboardModel {
  const months = main.months;
  const compareRows = compare?.rows ?? [];

  const receitaBruta = findRowByLabel(main.rows, 'RECEITA BRUTA');
  const receitaLiquida = findRowByLabel(main.rows, 'RECEITA LIQUIDA');
  const lucroLiquido = findRowByLabel(main.rows, 'LUCRO LIQUIDO');
  const custosDespesas = findRowByLabel(main.rows, 'CUSTOS E DESPESAS');

  const receitaBrutaCompare = compare ? findRowByLabel(compareRows, 'RECEITA BRUTA') : undefined;
  const receitaLiquidaCompare = compare ? findRowByLabel(compareRows, 'RECEITA LIQUIDA') : undefined;
  const lucroLiquidoCompare = compare ? findRowByLabel(compareRows, 'LUCRO LIQUIDO') : undefined;
  const custosDespesasCompare = compare ? findRowByLabel(compareRows, 'CUSTOS E DESPESAS') : undefined;

  const kpis: DashboardKpi[] = [
    {
      key: 'receita-bruta',
      label: 'Receita bruta',
      value: totalFromRow(receitaBruta, mode),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(totalFromRow(receitaBruta, mode), totalFromRow(receitaBrutaCompare, mode));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(receitaBruta, months, mode),
    },
    {
      key: 'receita-liquida',
      label: 'Receita liquida',
      value: totalFromRow(receitaLiquida, mode),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(totalFromRow(receitaLiquida, mode), totalFromRow(receitaLiquidaCompare, mode));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(receitaLiquida, months, mode),
    },
    {
      key: 'lucro-liquido',
      label: 'Lucro liquido',
      value: totalFromRow(lucroLiquido, mode),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(totalFromRow(lucroLiquido, mode), totalFromRow(lucroLiquidoCompare, mode));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(lucroLiquido, months, mode),
    },
    {
      key: 'custos-despesas',
      label: 'Custos/Despesas operacionais',
      value: totalFromRow(custosDespesas, mode),
      ...(() => {
        if (!compare) return { yoyValue: null, yoyPct: null };
        const delta = calcDelta(totalFromRow(custosDespesas, mode), totalFromRow(custosDespesasCompare, mode));
        return { yoyValue: delta.abs, yoyPct: delta.pct };
      })(),
      series: seriesFromRow(custosDespesas, months, mode),
    },
  ];

  const volatilitySeries = months.map((month) => ({
    month,
    value: main.summary.porMes[month]?.total ?? 0,
  }));

  const best = volatilitySeries.length
    ? volatilitySeries.reduce((acc, item) => (item.value > acc.value ? item : acc), volatilitySeries[0])
    : null;
  const worst = volatilitySeries.length
    ? volatilitySeries.reduce((acc, item) => (item.value < acc.value ? item : acc), volatilitySeries[0])
    : null;

  const rowTotal = (row: DreRow) =>
    Object.values(row.valoresPorMes).reduce((sum, value) => {
      const next = mode === 'projetado' ? value.projetado ?? value.previsto : value[mode];
      return sum + (next ?? 0);
    }, 0);

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

  const topGains = main.rows
    .filter((row) => row.nivel >= 2)
    .map((row) => ({ name: row.descricao, value: rowTotal(row) }))
    .filter((item) => item.value > 0)
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
    accountTree: buildTree(main.rows, mode),
  };
}
