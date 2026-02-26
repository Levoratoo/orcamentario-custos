'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { backend, DreExerciseAccumulatedResponse, DreTreeResponse } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExerciseComparisonTable } from '@/features/dre/exercise-comparison-table';
import { rechartsTheme } from '@/lib/recharts-theme';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return `${percentFormatter.format(value * 100)}%`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(value)}`;
}

function normalizeLabelKey(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function rowComparisonKey(row: { codigo?: string | null; descricao: string }) {
  return row.codigo?.trim() || normalizeLabelKey(row.descricao);
}

function sumProjectedYear(row: DreTreeResponse['rows'][number]) {
  return Object.values(row.valoresPorMes ?? {}).reduce(
    (sum, month) => sum + (month.projetado ?? month.realizado + month.previsto),
    0,
  );
}

export default function DreExercicioProjetadoPage() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const params = useSearchParams();
  const queryYear = Number(params.get('year'));

  const budgetsQuery = useQuery({
    queryKey: ['budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
  });

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          (budgetsQuery.data ?? [])
            .filter((budget) => budget.kind === 'BUDGET' && budget.status === 'READY')
            .map((budget) => budget.year),
        ),
      ).sort((a, b) => b - a),
    [budgetsQuery.data],
  );

  const year = Number.isFinite(queryYear) && years.includes(queryYear) ? queryYear : years[0] ?? new Date().getFullYear();
  const previousYear = year - 1;

  const budgetByYear = useMemo(() => {
    const readyBudgets = (budgetsQuery.data ?? []).filter((budget) => budget.kind === 'BUDGET' && budget.status === 'READY');
    const pickLatest = (targetYear: number) =>
      readyBudgets
        .filter((budget) => budget.year === targetYear)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    return {
      previous: pickLatest(previousYear),
      current: pickLatest(year),
    };
  }, [budgetsQuery.data, previousYear, year]);

  const currentTreeQuery = useQuery({
    queryKey: ['dre-exercicio-projetado-tree', year, budgetByYear.current?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.current!.id, 'DRE'),
    enabled: Boolean(budgetByYear.current?.id),
  });

  const previousTreeQuery = useQuery({
    queryKey: ['dre-exercicio-projetado-tree', previousYear, budgetByYear.previous?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.previous!.id, 'DRE'),
    enabled: Boolean(budgetByYear.previous?.id),
  });

  const projectedData = useMemo<DreExerciseAccumulatedResponse | null>(() => {
    const currentRows = currentTreeQuery.data?.rows ?? [];
    const previousRows = previousTreeQuery.data?.rows ?? [];
    if (currentRows.length === 0 && previousRows.length === 0) return null;

    const previousByKey = new Map(previousRows.map((row) => [rowComparisonKey(row), row] as const));
    const usedPrevious = new Set<string>();

    const mergedRows: DreExerciseAccumulatedResponse['rows'] = currentRows.map((currentRow) => {
      const key = rowComparisonKey(currentRow);
      const previousRow = previousByKey.get(key);
      if (previousRow) usedPrevious.add(key);

      const currentValue = sumProjectedYear(currentRow);
      const previousValue = previousRow ? sumProjectedYear(previousRow) : 0;
      const deltaValue = currentValue - previousValue;
      const deltaPct = previousValue !== 0 ? deltaValue / previousValue : null;

      return {
        id: currentRow.id,
        codigo: currentRow.codigo ?? null,
        descricao: currentRow.descricao,
        nivel: currentRow.nivel,
        parentId: currentRow.parentId ?? null,
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      };
    });

    previousRows.forEach((previousRow) => {
      const key = rowComparisonKey(previousRow);
      if (usedPrevious.has(key)) return;

      const previousValue = sumProjectedYear(previousRow);
      const currentValue = 0;
      const deltaValue = currentValue - previousValue;
      const deltaPct = previousValue !== 0 ? deltaValue / previousValue : null;

      mergedRows.push({
        id: `${previousRow.id}-prev`,
        codigo: previousRow.codigo ?? null,
        descricao: previousRow.descricao,
        nivel: previousRow.nivel,
        parentId: null,
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      });
    });

    const previousValue = previousTreeQuery.data?.grandTotals?.projetadoTotal ?? 0;
    const currentValue = currentTreeQuery.data?.grandTotals?.projetadoTotal ?? 0;
    const deltaValue = currentValue - previousValue;
    const deltaPct = previousValue !== 0 ? deltaValue / previousValue : null;

    return {
      year,
      compareYear: previousYear,
      lastClosedMonth: currentTreeQuery.data?.closingMonth ?? 12,
      cutoffMonth: 12,
      totals: {
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      },
      rows: mergedRows,
    };
  }, [currentTreeQuery.data, previousTreeQuery.data, year, previousYear]);

  const movers = useMemo(() => {
    const rows = projectedData?.rows ?? [];
    return [...rows]
      .sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue))
      .slice(0, 8)
      .map((row) => ({
        name: row.descricao.length > 28 ? `${row.descricao.slice(0, 28)}...` : row.descricao,
        delta: row.deltaValue,
      }));
  }, [projectedData?.rows]);

  const chartSummary = useMemo(() => {
    const positives = movers.filter((item) => item.delta >= 0);
    const negatives = movers.filter((item) => item.delta < 0);
    const topPositive = positives.sort((left, right) => right.delta - left.delta)[0] ?? null;
    const topNegative = negatives.sort((left, right) => left.delta - right.delta)[0] ?? null;
    const impact = movers.reduce((sum, item) => sum + Math.abs(item.delta), 0);
    return {
      positiveCount: positives.length,
      negativeCount: negatives.length,
      topPositive,
      topNegative,
      impact,
    };
  }, [movers]);

  const setQuery = (nextYear: number) => {
    router.replace(`/dre/exercicio-projetado?year=${nextYear}`);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/dre/analises');
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={handleBack}
                className="mb-3 inline-flex h-11 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-5 text-base font-semibold text-[color:var(--accent)] shadow-sm hover:bg-[color:var(--surface-3)]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar
              </Button>
              <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--accent)]/80">Analise Projetada</div>
              <h1 className="text-4xl font-semibold leading-tight text-foreground">Demonstracao do Resultado do Exercicio Projetado</h1>
              <p className="text-sm text-muted-foreground">Visao anual Jan-Dez: realizado + orcado projetado.</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
                  Horizonte anual completo
                </Badge>
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  {movers.length} principais variacoes
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onValueChange={(value) => setQuery(Number(value))}>
                <SelectTrigger className="h-10 w-[150px] border-border/70 bg-[color:var(--surface-1)] shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge className="h-10 border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 text-[color:var(--accent)]">
                Comparando com: {previousYear}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Projetado Ano Atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-2xl font-semibold tabular-nums text-foreground">
                <div>{formatCurrency(projectedData?.totals.currentValue ?? 0)}</div>
                <div className="text-xs font-normal text-muted-foreground">Ano {year}</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Projetado Ano Anterior</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-2xl font-semibold tabular-nums text-foreground">
                <div>{formatCurrency(projectedData?.totals.previousValue ?? 0)}</div>
                <div className="text-xs font-normal text-muted-foreground">Comparativo direto</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Delta R$</CardTitle>
              </CardHeader>
              <CardContent
                className={`space-y-1 text-2xl font-semibold tabular-nums ${(projectedData?.totals.deltaValue ?? 0) >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}
              >
                <div>{formatCurrency(projectedData?.totals.deltaValue ?? 0)}</div>
                <div className="text-xs font-normal text-muted-foreground">Diferenca anual</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Delta %</CardTitle>
              </CardHeader>
              <CardContent
                className={`space-y-1 text-2xl font-semibold tabular-nums ${(projectedData?.totals.deltaPct ?? 0) >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}
              >
                <div>{formatPercent(projectedData?.totals.deltaPct ?? null)}</div>
                <div className="text-xs font-normal text-muted-foreground">Variacao percentual</div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/92 shadow-sm">
            <CardHeader className="pb-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm text-foreground">Top Variacoes Projetadas (Delta R$)</CardTitle>
                  <p className="text-xs text-muted-foreground">Maiores impactos absolutos na visao projetada anual.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    +{chartSummary.positiveCount} positivas
                  </Badge>
                  <Badge className="border border-rose-300/70 bg-rose-500/10 text-rose-500">
                    {chartSummary.negativeCount} negativas
                  </Badge>
                  <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
                    Impacto {formatCompactCurrency(chartSummary.impact)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movers} margin={{ left: 8, right: 12, top: 14, bottom: 6 }}>
                    <CartesianGrid stroke={rechartsTheme.gridStroke} vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={rechartsTheme.axisTick}
                      stroke={rechartsTheme.axisStroke}
                      tickFormatter={(label: string) => (label.length > 22 ? `${label.slice(0, 22)}...` : label)}
                    />
                    <YAxis
                      tick={rechartsTheme.axisTick}
                      stroke={rechartsTheme.axisStroke}
                      tickFormatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                    />
                    <ReferenceLine y={0} stroke={rechartsTheme.referenceLineStroke} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: 'rgba(47,119,186,0.08)' }}
                      contentStyle={rechartsTheme.tooltipContent}
                      labelStyle={rechartsTheme.tooltipLabel}
                      itemStyle={rechartsTheme.tooltipItem}
                    />
                    <Bar dataKey="delta" radius={[8, 8, 8, 8]} maxBarSize={42}>
                      {movers.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}-${index}`}
                          fill={entry.delta >= 0 ? 'rgba(47,119,186,0.86)' : 'rgba(228,112,128,0.86)'}
                        />
                      ))}
                      <LabelList
                        dataKey="delta"
                        position="top"
                        formatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                        fill={rechartsTheme.valueLabel.fill}
                        fontSize={rechartsTheme.valueLabel.fontSize}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-[color:var(--surface-2)]/75 px-3 py-2 text-xs">
                  <div className="uppercase tracking-wide text-muted-foreground">Maior alta</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{chartSummary.topPositive?.name ?? '--'}</span>
                    <span className="font-semibold text-[color:var(--accent)]">
                      {chartSummary.topPositive ? formatCurrency(chartSummary.topPositive.delta) : '--'}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-[color:var(--surface-2)]/75 px-3 py-2 text-xs">
                  <div className="uppercase tracking-wide text-muted-foreground">Maior queda</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{chartSummary.topNegative?.name ?? '--'}</span>
                    <span className="font-semibold text-rose-500">
                      {chartSummary.topNegative ? formatCurrency(chartSummary.topNegative.delta) : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {projectedData ? (
        <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
          <CardContent className="p-4">
            <ExerciseComparisonTable
              rows={projectedData.rows}
              previousLabel={`Projetado ${projectedData.compareYear} (jan-dez)`}
              currentLabel={`Projetado ${projectedData.year} (jan-dez)`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/70 bg-[color:var(--surface-1)] px-4 py-3 text-sm text-muted-foreground">
          Carregando...
        </div>
      )}
    </div>
  );
}

