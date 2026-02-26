'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BudgetSelector } from '@/components/shared/budget-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DreDialog } from '@/features/budget-scenario/dre-dialog';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { useDre } from '@/hooks/use-dre';
import { formatCurrencyBRL } from '@/lib/formatters';
import { compareSummaries, formatDelta } from '@/services/dre/compare-dre';
import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';

export default function BudgetScenarioPage() {
  const { apiFetch } = useApiClient();
  const { budgetId, setBudgetId } = useSelectedBudget();
  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch) });
  const selectedBudget = budgets.find((budget) => budget.id === budgetId) ?? null;
  const [selectedYear, setSelectedYear] = useState(selectedBudget?.year ?? new Date().getFullYear());
  const [compareEnabled, setCompareEnabled] = useState(false);

  const compareBudget = selectedBudget
    ? budgets.find((budget) => budget.year === selectedBudget.year - 1 && budget.kind === selectedBudget.kind && budget.status === 'READY')
    : null;
  const compareYear = selectedBudget ? selectedBudget.year - 1 : selectedYear - 1;
  const compareAllowed = Boolean(compareBudget);
  const isCompareOn = compareAllowed && compareEnabled;

  useEffect(() => {
    if (!compareAllowed) {
      setCompareEnabled(false);
    }
  }, [compareAllowed]);

  useEffect(() => {
    if (selectedBudget?.year) {
      setSelectedYear(selectedBudget.year);
    }
  }, [selectedBudget?.year]);

  const dreMain = useDre({ budgetId: selectedBudget?.id ?? null, mode: 'previsto' });
  const dreCompare = useDre({ budgetId: compareBudget?.id ?? null, mode: 'previsto' });

  const summary = dreMain.summary;
  const deltas = useMemo(() => compareSummaries(dreMain.summary, dreCompare.summary), [dreMain.summary, dreCompare.summary]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orcamento cenario</h1>
          <p className="text-sm text-muted-foreground">Importe planilhas e acompanhe receitas e custos por ano.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetSelector />
          <Select
            value={String(selectedYear)}
            onValueChange={(value) => {
              const year = Number(value);
              setSelectedYear(year);
              const yearBudget = budgets.find((budget) => budget.year === year && budget.status === 'READY');
              if (yearBudget) {
                setBudgetId(yearBudget.id);
              }
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {budgets
                .filter((budget) => budget.status === 'READY')
                .map((budget) => budget.year)
                .filter((year, index, list) => list.indexOf(year) === index)
                .map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    Orcamento {year}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            <Switch
              checked={compareEnabled}
              onCheckedChange={setCompareEnabled}
              disabled={!compareAllowed}
              title={!compareAllowed ? 'Sem base comparativa' : undefined}
            />
            <span>Comparar com ano anterior</span>
          </div>
          <DreDialog defaultBudgetId={selectedBudget?.id ?? null} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total anual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{formatCurrencyBRL(summary?.totalAnual ?? 0)}</div>
            {isCompareOn && (
              <div className={deltas.totalAnual.abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatDelta(deltas.totalAnual, compareYear)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{formatCurrencyBRL(summary?.totalReceitas ?? 0)}</div>
            {isCompareOn && (
              <div className={deltas.totalReceitas.abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatDelta(deltas.totalReceitas, compareYear)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custos e despesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{formatCurrencyBRL(summary?.totalCustosDespesas ?? 0)}</div>
            {isCompareOn && (
              <div className={deltas.totalCustosDespesas.abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatDelta(deltas.totalCustosDespesas, compareYear)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="card-glow relative overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Setores ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{summary?.setoresAtivos ?? 0}</div>
            <div className="text-xs text-muted-foreground">Com movimentacao</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
