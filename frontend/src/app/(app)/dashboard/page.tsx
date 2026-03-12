'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { BudgetSelector } from '@/components/shared/budget-selector';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DreDialog } from '@/features/budget-scenario/dre-dialog';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { calcDelta } from '@/services/dre/compare-dre';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RankingBar } from '@/components/dashboard/RankingBar';
import { DetailsDrawer } from '@/components/dashboard/DetailsDrawer';
import { FaturamentoEbitdaChart } from '@/components/dashboard/FaturamentoEbitdaChart';
import { DreRow } from '@/services/dre/types';
import { DreModeToggle } from '@/components/shared/dre-mode-toggle';
import { useDreMode } from '@/hooks/use-dre-mode';
import { ProjectedInfoBadge } from '@/components/shared/projected-info-badge';

type DrawerPayload = {
  title: string;
  subtitle: string;
  rows: DreRow[];
  summaryValue: number;
  summaryPct?: number | null;
  deltaValue?: number | null;
  deltaPct?: number | null;
  monthFilter?: string | null;
  rawPayload?: unknown;
  calculation?: {
    formula: string;
    result: number;
    components: Array<{ label: string; value: number }>;
    note?: string;
  };
};

type PeriodMode = 'monthly' | 'annual';

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const kpiSourceLabelByKey: Record<string, string> = {
  'receita-bruta': 'RECEITA BRUTA',
  ebitda: 'EBITDA',
  'lucro-liquido': 'LUCRO LIQUIDO',
  'receita-liquida': 'RECEITA LIQUIDA',
  'custos-despesas': 'CUSTOS E DESPESAS',
};

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getMonthValue(
  value: DreRow['valoresPorMes'][string],
  mode: 'previsto' | 'realizado' | 'projetado' | 'dre' | 'ambos',
) {
  if (!value) return 0;
  if (mode === 'projetado') return value.projetado ?? value.previsto ?? 0;
  if (mode === 'realizado' || mode === 'previsto') return value[mode] ?? 0;
  return value.previsto ?? 0;
}

function monthNumberFromKey(monthKey: string) {
  return Number(monthKey.split('-')[1] ?? 0);
}

function includeMonthInScope(monthKey: string, periodMode: PeriodMode, selectedMonth: number) {
  const month = monthNumberFromKey(monthKey);
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (periodMode === 'monthly') return month === selectedMonth;
  return month <= selectedMonth;
}

function modeLabel(mode: 'previsto' | 'realizado' | 'projetado' | 'dre' | 'ambos') {
  if (mode === 'realizado') return 'Realizado';
  if (mode === 'projetado') return 'Variacao';
  return 'Orcado';
}

function monthKeyFromDisplay(monthDisplay: string) {
  if (/^\d{4}-\d{2}$/.test(monthDisplay)) return monthDisplay;
  const [month, year] = monthDisplay.split('/');
  if (!month || !year) return null;
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return null;
  return `${year}-${String(parsedMonth).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { apiFetch } = useApiClient();
  const { budgetId } = useSelectedBudget();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload | null>(null);
  const [dreOpen, setDreOpen] = useState(false);
  const { mode, setMode } = useDreMode();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('annual');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const budgetsQuery = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch) });
  const budgets = budgetsQuery.data ?? [];
  const selected = budgets.find((item) => item.id === budgetId) ?? null;
  const selectedYear = selected?.year ?? new Date().getFullYear();
  const actualBudget = selected
    ? budgets.find((item) => item.year === selected.year && item.kind === 'ACTUAL' && item.status === 'READY')
    : null;
  const compareYear = selected ? selected.year - 1 : selectedYear - 1;
  const compareActual = budgets.find((item) => item.year === compareYear && item.kind === 'ACTUAL' && item.status === 'READY');
  const compareBudget = budgets.find((item) => item.year === compareYear && item.kind === 'BUDGET' && item.status === 'READY');
  const compareSelected =
    mode === 'realizado'
      ? compareActual ?? compareBudget ?? null
      : compareBudget ?? compareActual ?? null;
  const compareBudgetIdForHook =
    mode === 'projetado'
      ? compareBudget?.id ?? compareActual?.id ?? null
      : compareSelected?.id ?? null;
  const compareLabel = compareSelected ? `vs ${compareYear}` : 'Sem base comparativa';

  const { model, main, compare, loading } = useDashboardData(
    selected?.id ?? null,
    compareBudgetIdForHook,
    selectedYear,
    mode === 'realizado' || mode === 'projetado' ? mode : 'previsto',
    actualBudget?.id ?? null,
    compareActual?.id ?? null,
    periodMode,
    selectedMonth,
    selectedMonth,
  );

  const rows = main.rows;
  const closingMonth = Math.max(1, Math.min(12, main.closingMonth ?? new Date().getMonth() + 1));

  useEffect(() => {
    setSelectedMonth(closingMonth);
  }, [selected?.id, closingMonth]);

  useEffect(() => {
    if (!selected) return;
    if (selected.kind === 'ACTUAL') {
      setMode('realizado');
    }
  }, [selected?.kind, selected?.id, setMode, selected]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, string[]>();
    rows.forEach((row) => {
      const parentId = row.parentId ?? null;
      const list = map.get(parentId) ?? [];
      list.push(row.id);
      map.set(parentId, list);
    });
    return map;
  }, [rows]);

  const rowById = useMemo(() => {
    const map = new Map<string, DreRow>();
    rows.forEach((row) => map.set(row.id, row));
    return map;
  }, [rows]);

  const collectSubtree = useCallback(
    (rowId: string) => {
      const result: DreRow[] = [];
      const walk = (id: string) => {
        const row = rowById.get(id);
        if (!row) return;
        result.push(row);
        const children = childrenByParent.get(id) ?? [];
        children.forEach(walk);
      };
      walk(rowId);
      return result;
    },
    [childrenByParent, rowById],
  );

  const findRowByLabel = useCallback(
    (label: string) => {
      const target = normalizeLabel(label);
      return rows.find((row) => normalizeLabel(row.descricao).includes(target));
    },
    [rows],
  );

  const rowTotal = useCallback(
    (row: DreRow) => {
      return Object.entries(row.valoresPorMes).reduce((sum, [monthKey, value]) => {
        if (!includeMonthInScope(monthKey, periodMode, selectedMonth)) return sum;
        return sum + getMonthValue(value, mode);
      }, 0);
    },
    [mode, periodMode, selectedMonth],
  );

  const scopedMonthEntries = useCallback(
    (row: DreRow) =>
      Object.entries(row.valoresPorMes).filter(([monthKey]) =>
        includeMonthInScope(monthKey, periodMode, selectedMonth),
      ),
    [periodMode, selectedMonth],
  );

  const buildRowCalculation = useCallback(
    (row: DreRow, metricLabel: string) => {
      const components = scopedMonthEntries(row).map(([monthKey, value]) => ({
        label: monthKey,
        value: getMonthValue(value, mode),
      }));
      const result = components.reduce((sum, item) => sum + item.value, 0);
      return {
        formula:
          periodMode === 'monthly'
            ? `${metricLabel} = valor da linha no mes selecionado`
            : `${metricLabel} = soma dos meses ate o corte`,
        result,
        components,
        note: `Linha base: ${row.descricao}`,
      };
    },
    [scopedMonthEntries, mode, periodMode],
  );

  const buildRowsCalculation = useCallback(
    (rowsForCalc: DreRow[], metricLabel: string) => {
      const components = rowsForCalc.map((row) => ({
        label: row.descricao,
        value: rowTotal(row),
      }));
      const result = components.reduce((sum, item) => sum + item.value, 0);
      return {
        formula: `${metricLabel} = soma das contas selecionadas`,
        result,
        components,
      };
    },
    [rowTotal],
  );

  const periodLabel =
    periodMode === 'monthly'
      ? `${monthNames[selectedMonth - 1]}/${selectedYear}`
      : `Jan ate ${monthNames[selectedMonth - 1]}/${selectedYear}`;

  const buildRawPayload = useCallback(
    (
      chartName: string,
      selectedItem: string,
      sourceRows: DreRow[],
      calcRule: string,
      extra?: Record<string, unknown>,
    ) => ({
      grafico: chartName,
      itemSelecionado: selectedItem,
      regraCalculo: calcRule,
      origem: {
        endpoint: '/dre/tree?mode=DRE',
        linhasBase: sourceRows.slice(0, 80).map((row) => ({
          id: row.id,
          descricao: row.descricao,
          nivel: row.nivel,
          parentId: row.parentId ?? null,
        })),
      },
      periodo: {
        visao: periodMode === 'monthly' ? 'Mensal' : 'Anual acumulada',
        mesCorte: selectedMonth,
        referencia: periodLabel,
        modo: modeLabel(mode),
        comparativo: compareLabel,
        ano: selectedYear,
      },
      ...extra,
    }),
    [periodMode, selectedMonth, periodLabel, mode, compareLabel, selectedYear],
  );

  const openDrawer = useCallback((payload: DrawerPayload) => {
    setDrawerPayload(payload);
    setDrawerOpen(true);
  }, []);

  const handleKpiClick = useCallback(
    (kpiKey: string, kpiLabel: string) => {
      const sourceLabel = kpiSourceLabelByKey[kpiKey] ?? kpiLabel;
      const row = findRowByLabel(sourceLabel);
      const compareRow = compare.rows.find((item) => normalizeLabel(item.descricao).includes(normalizeLabel(sourceLabel)));
      const receitaRow = findRowByLabel('RECEITA BRUTA');
      if (!row) return;
      const value = rowTotal(row);
      const receitaValue = receitaRow ? rowTotal(receitaRow) : null;
      const delta = compareRow ? calcDelta(value, rowTotal(compareRow)) : null;
      const selectedRows = collectSubtree(row.id);
      openDrawer({
        title: kpiLabel,
        subtitle: `Ano ${selectedYear} - ${modeLabel(mode)} ${compareLabel}`,
        rows: selectedRows,
        summaryValue: value,
        summaryPct: receitaValue ? (value / receitaValue) * 100 : null,
        deltaValue: delta?.abs ?? null,
        deltaPct: delta?.pct ?? null,
        rawPayload: buildRawPayload(
          'KPIs',
          `${kpiLabel} (${sourceLabel})`,
          selectedRows,
          `Soma da linha "${row.descricao}" no recorte ${periodMode === 'monthly' ? 'mensal' : 'anual acumulado'}.`,
          {
            linhaPrincipal: { id: row.id, descricao: row.descricao },
          },
        ),
        calculation: buildRowCalculation(row, kpiLabel),
      });
    },
    [
      findRowByLabel,
      compare.rows,
      rowTotal,
      openDrawer,
      selectedYear,
      mode,
      compareLabel,
      collectSubtree,
      buildRawPayload,
      periodMode,
      buildRowCalculation,
    ],
  );

  const handleRankingClick = useCallback(
    (chartName: string, name: string) => {
      const row = rows.find((item) => item.descricao === name);
      const selectedRows = row ? collectSubtree(row.id) : rows.filter((item) => item.descricao.includes(name));
      const receitaRow = findRowByLabel('RECEITA BRUTA');
      const summaryValue = selectedRows.reduce((sum, item) => sum + rowTotal(item), 0);
      const receitaValue = receitaRow ? rowTotal(receitaRow) : null;
      const calcRule =
        chartName === 'Top ganhos por linha de produto'
          ? 'Somatorio de valores positivos agrupado pela conta pai da arvore DRE, excluindo rotulos com "CATALOGOS".'
          : chartName === 'Top perdas'
            ? 'Top 5 linhas com menor valor (mais negativas) no recorte da tela.'
            : 'Top 5 linhas por maior valor no recorte da tela.';
      openDrawer({
        title: name,
        subtitle: `${chartName} - Ano ${selectedYear} - ${modeLabel(mode)} ${compareLabel}`,
        rows: selectedRows,
        summaryValue,
        summaryPct: receitaValue ? (summaryValue / receitaValue) * 100 : null,
        rawPayload: buildRawPayload(chartName, name, selectedRows, calcRule, {
          agrupamento: chartName === 'Top ganhos por linha de produto' ? 'Conta pai DRE (linha de produto)' : 'Conta DRE',
          valorSelecionado: summaryValue,
        }),
        calculation: buildRowsCalculation(selectedRows, name),
      });
    },
    [
      rows,
      collectSubtree,
      findRowByLabel,
      rowTotal,
      openDrawer,
      selectedYear,
      mode,
      compareLabel,
      buildRawPayload,
      buildRowsCalculation,
    ],
  );

  const drawerMode = mode === 'realizado' || mode === 'projetado' ? mode : 'previsto';

  const handleFaturamentoEbitdaPointClick = useCallback(
    (point: { month: string; metric: 'faturamento' | 'ebitda'; value: number }) => {
      const isFaturamento = point.metric === 'faturamento';
      const metricTitle = isFaturamento ? 'Faturamento' : 'EBITDA';
      const sourceLabel = isFaturamento ? 'RECEITA BRUTA' : 'EBITDA';
      const row = findRowByLabel(sourceLabel);
      if (!row) return;
      const sourceRows = collectSubtree(row.id);
      const receitaRow = findRowByLabel('RECEITA BRUTA');
      const monthKey = monthKeyFromDisplay(point.month);
      const receitaMonthValue =
        monthKey && receitaRow ? getMonthValue(receitaRow.valoresPorMes[monthKey], mode) : null;

      openDrawer({
        title: `${metricTitle} - ${point.month}`,
        subtitle: `Ano ${selectedYear} - ${modeLabel(mode)} ${compareLabel}`,
        rows: sourceRows,
        monthFilter: monthKey,
        summaryValue: point.value,
        summaryPct: receitaMonthValue ? (point.value / receitaMonthValue) * 100 : null,
        rawPayload: buildRawPayload(
          'Faturamento x EBITDA',
          `${metricTitle} (${point.month})`,
          sourceRows,
          `Serie mensal da linha "${row.descricao}" para o mes selecionado.`,
          {
            serie: metricTitle,
            mesSelecionado: point.month,
            mesChave: monthKey,
            valorSelecionado: point.value,
            linhaPrincipal: { id: row.id, descricao: row.descricao },
          },
        ),
        calculation: {
          formula: `${metricTitle} (${point.month}) = valor da linha no mes selecionado`,
          result: point.value,
          components: [
            {
              label: row.descricao,
              value: point.value,
            },
          ],
          note: monthKey ? `Mes de referencia: ${monthKey}` : undefined,
        },
      });
    },
    [findRowByLabel, collectSubtree, mode, selectedYear, compareLabel, openDrawer, buildRawPayload],
  );

  const faturamentoSeries = useMemo(
    () => model?.kpis.find((item) => item.key === 'receita-bruta')?.series ?? [],
    [model],
  );
  const ebitdaSeries = useMemo(
    () => model?.kpis.find((item) => item.key === 'ebitda')?.series ?? [],
    [model],
  );

  if (budgetsQuery.isLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="-mx-2 border-b border-border/70 bg-background/95 px-2 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-10 w-[220px]" />
              <Skeleton className="h-10 w-[200px]" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`dashboard-kpi-loading-${index}`} className="h-[176px] rounded-2xl" />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[260px] rounded-2xl" />
          <Skeleton className="h-[260px] rounded-2xl" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[260px] rounded-2xl" />
          <Skeleton className="h-[260px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <EmptyState
        title="Sem dados do DRE"
        description="Verifique se os arquivos do DRE estao carregados."
        action={<BudgetSelector />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="-mx-2 border-b border-border/70 bg-background/95 px-2 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard - {modeLabel(mode)}</h1>
            <p className="text-sm text-muted-foreground">Visao executiva por periodo selecionado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BudgetSelector />
            <DreModeToggle />
            <DreDialog defaultBudgetId={selected?.id} open={dreOpen} onOpenChange={setDreOpen} />
          </div>
        </div>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            Status: {selected.status}
          </Badge>
          <Badge className="border border-border/60 bg-[color:var(--surface-3)] text-muted-foreground">
            Periodo: {periodMode === 'monthly' ? 'Mensal' : 'Anual acumulado ate'} {monthNames[selectedMonth - 1]}
          </Badge>
          {mode === 'projetado' && <ProjectedInfoBadge />}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {model.kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            yoyValue={kpi.yoyValue}
            yoyPct={kpi.yoyPct}
            series={kpi.series}
            onClick={() => handleKpiClick(kpi.key, kpi.label)}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FaturamentoEbitdaChart
          faturamentoSeries={faturamentoSeries.map((item) => ({ ...item, month: item.month.split('-').reverse().join('/') }))}
          ebitdaSeries={ebitdaSeries.map((item) => ({ ...item, month: item.month.split('-').reverse().join('/') }))}
          onPointClick={handleFaturamentoEbitdaPointClick}
        />
        <RankingBar
          title="Top centros de custo"
          items={model.topCostCenters}
          onItemClick={(item) => handleRankingClick('Top centros de custo', item.name)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingBar
          title="Top contas"
          items={model.topAccounts}
          onItemClick={(item) => handleRankingClick('Top contas', item.name)}
        />
        <RankingBar
          title="Top ganhos por linha de produto"
          items={model.topGains}
          onItemClick={(item) => handleRankingClick('Top ganhos por linha de produto', item.name)}
          accent="var(--accent-2)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingBar
          title="Top perdas"
          items={model.topLosses}
          onItemClick={(item) => handleRankingClick('Top perdas', item.name)}
          accent="#f87171"
        />
      </div>

      {drawerPayload && (
        <DetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={drawerPayload.title}
          subtitle={drawerPayload.subtitle}
          rows={drawerPayload.rows}
          monthFilter={drawerPayload.monthFilter}
          mode={drawerMode}
          summary={{
            value: drawerPayload.summaryValue,
            pctOfRevenue: drawerPayload.summaryPct,
            deltaValue: drawerPayload.deltaValue,
            deltaPct: drawerPayload.deltaPct,
            compareYear,
          }}
          rawPayload={drawerPayload.rawPayload}
          calculation={drawerPayload.calculation}
          onViewDre={() => {
            setDrawerOpen(false);
            setDreOpen(true);
          }}
        />
      )}
    </div>
  );
}
