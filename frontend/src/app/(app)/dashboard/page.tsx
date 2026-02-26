'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { BudgetSelector } from '@/components/shared/budget-selector';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDeltaValue } from '@/lib/format';
import { useAuth } from '@/components/providers/auth-provider';
import { Activity, CircleDollarSign } from 'lucide-react';
import { DreDialog } from '@/features/budget-scenario/dre-dialog';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { calcDelta } from '@/services/dre/compare-dre';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RankingBar } from '@/components/dashboard/RankingBar';
import { MonthlyLine } from '@/components/dashboard/MonthlyLine';
import { DetailsDrawer } from '@/components/dashboard/DetailsDrawer';
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

export default function DashboardPage() {
  const { apiFetch } = useApiClient();
  const { budgetId } = useSelectedBudget();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPayload, setDrawerPayload] = useState<DrawerPayload | null>(null);
  const [dreOpen, setDreOpen] = useState(false);
  const { mode, setMode } = useDreMode();

  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch) });
  const selected = budgets.find((item) => item.id === budgetId) ?? null;
  const selectedYear = selected?.year ?? new Date().getFullYear();
  const actualBudget = selected
    ? budgets.find((item) => item.year === selected.year && item.kind === 'ACTUAL' && item.status === 'READY')
    : null;
  const compareYear = selected ? selected.year - 1 : selectedYear - 1;
  const compareActual = budgets.find((item) => item.year === compareYear && item.kind === 'ACTUAL' && item.status === 'READY');
  const compareBudget = budgets.find((item) => item.year === compareYear && item.kind === 'BUDGET' && item.status === 'READY');
  const compareSelected = compareActual ?? compareBudget ?? null;
  const compareLabel = compareSelected ? `vs ${compareYear}` : 'Sem base comparativa';

  const { model, main, compare } = useDashboardData(
    selected?.id ?? null,
    compareSelected?.id ?? null,
    selectedYear,
    mode === 'realizado' || mode === 'projetado' ? mode : 'previsto',
    actualBudget?.id ?? null,
    compareActual?.id ?? null,
  );
  const rows = main.rows;

  useEffect(() => {
    if (!selected) return;
    if (selected.kind === 'ACTUAL') {
      setMode('realizado');
    }
  }, [selected?.kind, selected?.id]);

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
      return Object.values(row.valoresPorMes).reduce((sum, value) => {
        const next = getMonthValue(value, mode);
        return sum + (next ?? 0);
      }, 0);
    },
    [mode],
  );

  const openDrawer = useCallback(
    (payload: DrawerPayload) => {
      setDrawerPayload(payload);
      setDrawerOpen(true);
    },
    [],
  );

  const handleKpiClick = useCallback(
    (label: string) => {
      const row = findRowByLabel(label);
      const compareRow = compare.rows.find((item) => normalizeLabel(item.descricao).includes(normalizeLabel(label)));
      const receitaRow = findRowByLabel('RECEITA BRUTA');
      if (!row) return;
      const value = rowTotal(row);
      const receitaValue = receitaRow ? rowTotal(receitaRow) : null;
      const delta = compareRow ? calcDelta(value, rowTotal(compareRow)) : null;
      openDrawer({
        title: label,
        subtitle: `Ano ${selectedYear} - ${mode === 'realizado' ? 'Realizado' : mode === 'projetado' ? 'Projetado' : 'Previsto'} ${compareLabel}`,
        rows: collectSubtree(row.id),
        summaryValue: value,
        summaryPct: receitaValue ? (value / receitaValue) * 100 : null,
        deltaValue: delta?.abs ?? null,
        deltaPct: delta?.pct ?? null,
      });
    },
    [findRowByLabel, collectSubtree, selectedYear, compareYear, openDrawer, compare.rows, rowTotal],
  );

  const handleRankingClick = useCallback(
    (name: string) => {
      const row = rows.find((item) => item.descricao === name);
      const selectedRows = row ? collectSubtree(row.id) : rows.filter((item) => item.descricao.includes(name));
      const receitaRow = findRowByLabel('RECEITA BRUTA');
      const summaryValue = selectedRows.reduce((sum, item) => sum + rowTotal(item), 0);
      const receitaValue = receitaRow ? rowTotal(receitaRow) : null;
      openDrawer({
        title: name,
        subtitle: `Ano ${selectedYear} - ${mode === 'realizado' ? 'Realizado' : mode === 'projetado' ? 'Projetado' : 'Previsto'} ${compareLabel}`,
        rows: selectedRows,
        summaryValue,
        summaryPct: receitaValue ? (summaryValue / receitaValue) * 100 : null,
      });
    },
    [rows, collectSubtree, selectedYear, compareYear, openDrawer, rowTotal, findRowByLabel],
  );

  const handleMonthClick = useCallback(
    (month: string) => {
      openDrawer({
        title: 'Volatilidade mensal',
        subtitle: `Mes ${month} - Ano ${selectedYear} (${mode === 'realizado' ? 'Realizado' : mode === 'projetado' ? 'Projetado' : 'Previsto'})`,
        rows,
        summaryValue: model?.volatility.series.find((item) => item.month === month)?.value ?? 0,
        monthFilter: month,
      });
    },
    [openDrawer, rows, selectedYear, model],
  );

  const totalAnnual = main.summary?.totalAnual ?? 0;
  const drawerMode = mode === 'realizado' || mode === 'projetado' ? mode : 'previsto';
  const currentMonthKey = `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonthValue = main.summary?.porMes?.[currentMonthKey]?.total ?? 0;
  const compareMonthKey = `${compareYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const bestWorst = useMemo(() => {
    if (!model?.volatility.series.length) return { best: null, worst: null };
    const series = model.volatility.series;
    const best = series.reduce((acc, item) => (item.value > acc.value ? item : acc), series[0]);
    const worst = series.reduce((acc, item) => (item.value < acc.value ? item : acc), series[0]);
    return {
      best: { month: best.month.split('-').reverse().join('/'), value: best.value },
      worst: { month: worst.month.split('-').reverse().join('/'), value: worst.value },
    };
  }, [model]);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Dashboard - {mode === 'realizado' ? 'Realizado' : mode === 'projetado' ? 'Projetado' : 'Previsto'}
          </h1>
          <p className="text-sm text-muted-foreground">Visao executiva do orcamento selecionado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetSelector />
          <DreModeToggle />
          <DreDialog defaultBudgetId={selected?.id} open={dreOpen} onOpenChange={setDreOpen} />
        </div>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            Status: {selected.status}
          </Badge>
          <Badge className="border border-border/60 bg-[color:var(--surface-3)] text-muted-foreground">
            Modo: {mode === 'previsto' ? 'Previsto' : mode === 'realizado' ? 'Realizado' : 'Projetado'}
          </Badge>
          {mode === 'projetado' && <ProjectedInfoBadge />}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {model.kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            yoyValue={kpi.yoyValue}
            yoyPct={kpi.yoyPct}
            series={kpi.series}
            onClick={() => handleKpiClick(kpi.label)}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total anual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={totalAnnual < 0 ? 'text-rose-600 text-2xl font-semibold' : 'text-2xl font-semibold'}>
              {formatCurrency(totalAnnual)}
            </div>
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              {selected ? 'Atualizado' : '-'}
            </Badge>
          </CardContent>
          <CircleDollarSign className="absolute right-4 top-4 h-8 w-8 text-[color:var(--accent-soft)]" />
        </Card>
        {user?.role === 'COORDINATOR' && (
          <Card className="card-glow relative overflow-hidden rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meu escopo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={totalAnnual < 0 ? 'text-rose-600 text-2xl font-semibold' : 'text-2xl font-semibold'}>
                {formatCurrency(totalAnnual)}
              </div>
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                Em acompanhamento
              </Badge>
            </CardContent>
          </Card>
        )}
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total mes atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={currentMonthValue < 0 ? 'text-rose-600 text-2xl font-semibold' : 'text-2xl font-semibold'}>
              {formatCurrency(currentMonthValue)}
            </div>
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              {selected ? 'Mes corrente' : '-'}
            </Badge>
            {compare.summary && (
              <div className={currentMonthValue < 0 ? 'text-rose-600' : 'text-[color:var(--accent)]'}>
                {(() => {
                  const compareValue = compare.summary?.porMes?.[compareMonthKey]?.total ?? 0;
                  const delta = calcDelta(currentMonthValue, compareValue);
                  return formatDeltaValue(delta.abs, delta.pct, compareYear);
                })()}
              </div>
            )}
          </CardContent>
          <Activity className="absolute right-4 top-4 h-8 w-8 text-[color:var(--accent-soft)]" />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonthlyLine
          title="Volatilidade mensal"
          series={model.volatility.series.map((item) => ({ ...item, month: item.month.split('-').reverse().join('/') }))}
          best={bestWorst.best}
          worst={bestWorst.worst}
          onPointClick={(point) => handleMonthClick(point.month.split('/').reverse().join('-'))}
        />
        <RankingBar
          title="Top centros de custo"
          items={model.topCostCenters}
          onItemClick={(item) => handleRankingClick(item.name)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingBar
          title="Top contas"
          items={model.topAccounts}
          onItemClick={(item) => handleRankingClick(item.name)}
        />
        <RankingBar
          title="Top ganhos"
          items={model.topGains}
          onItemClick={(item) => handleRankingClick(item.name)}
          accent="var(--accent-2)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingBar
          title="Top perdas"
          items={model.topLosses}
          onItemClick={(item) => handleRankingClick(item.name)}
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
          rawPayload={user?.role === 'ADMIN' ? { model } : undefined}
          onViewDre={() => {
            setDrawerOpen(false);
            setDreOpen(true);
          }}
        />
      )}
    </div>
  );
}
