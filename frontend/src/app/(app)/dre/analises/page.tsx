'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { backend, DreExerciseRowResponse, DreTreeResponse } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { PageHeader } from '@/components/shared/page-header';
import { ExerciseComparisonTable } from '@/features/dre/exercise-comparison-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function toMonthKey(year: number, month: number) {
  return `${year}-${String(Math.max(1, Math.min(12, month))).padStart(2, '0')}`;
}

function sumVariationToMonth(
  row: DreTreeResponse['rows'][number] | undefined,
  year: number,
  cutoffMonth: number,
) {
  if (!row) return 0;
  let total = 0;
  for (let cursor = 1; cursor <= cutoffMonth; cursor += 1) {
    total += row.valoresPorMes[toMonthKey(year, cursor)]?.projetado ?? 0;
  }
  return total;
}

function buildUniqueId(baseId: string, seen: Map<string, number>) {
  const normalized = baseId.trim() || 'row';
  const current = seen.get(normalized) ?? 0;
  seen.set(normalized, current + 1);
  return current === 0 ? normalized : `${normalized}__${current}`;
}

function buildVariationRows(
  currentRows: DreTreeResponse['rows'],
  previousRows: DreTreeResponse['rows'],
  year: number,
  previousYear: number,
  cutoffMonth: number,
): DreExerciseRowResponse[] {
  if (currentRows.length === 0 && previousRows.length === 0) return [];

  const previousByKey = new Map(previousRows.map((row) => [rowComparisonKey(row), row] as const));
  const usedPrevious = new Set<string>();
  const rowIdCount = new Map<string, number>();

  const currentIdMap = new Map<string, string>();
  currentRows.forEach((row) => {
    const key = rowComparisonKey(row);
    currentIdMap.set(row.id, buildUniqueId(`current:${row.id || key}`, rowIdCount));
  });

  const mergedRows: DreExerciseRowResponse[] = currentRows.map((currentRow) => {
    const key = rowComparisonKey(currentRow);
    const previousRow = previousByKey.get(key);
    if (previousRow) usedPrevious.add(key);

    const currentValue = sumVariationToMonth(currentRow, year, cutoffMonth);
    const previousValue = sumVariationToMonth(previousRow, previousYear, cutoffMonth);
    const deltaValue = currentValue - previousValue;
    const deltaPct = previousValue !== 0 ? deltaValue / previousValue : null;

    return {
      id: currentIdMap.get(currentRow.id)!,
      codigo: currentRow.codigo ?? null,
      descricao: currentRow.descricao,
      nivel: currentRow.nivel,
      parentId: currentRow.parentId ? currentIdMap.get(currentRow.parentId) ?? null : null,
      previousValue,
      currentValue,
      deltaValue,
      deltaPct,
    };
  });

  previousRows.forEach((previousRow) => {
    const key = rowComparisonKey(previousRow);
    if (usedPrevious.has(key)) return;
    usedPrevious.add(key);
    const previousValue = sumVariationToMonth(previousRow, previousYear, cutoffMonth);
    mergedRows.push({
      id: buildUniqueId(`previous-only:${previousRow.id || key}`, rowIdCount),
      codigo: previousRow.codigo ?? null,
      descricao: previousRow.descricao,
      nivel: previousRow.nivel,
      parentId: null,
      previousValue,
      currentValue: 0,
      deltaValue: -previousValue,
      deltaPct: previousValue !== 0 ? -1 : null,
    });
  });

  return mergedRows;
}

export default function DreAnalisesPage() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const params = useSearchParams();
  const yearFromQuery = Number(params.get('year'));
  const monthFromQuery = Number(params.get('month'));

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
  });

  const years = useMemo(
    () =>
      Array.from(new Set(budgets.filter((budget) => budget.status === 'READY').map((budget) => budget.year))).sort((a, b) => b - a),
    [budgets],
  );

  const selectedYear =
    Number.isFinite(yearFromQuery) && years.includes(yearFromQuery)
      ? yearFromQuery
      : years[0] ?? new Date().getFullYear();
  const previousYear = selectedYear - 1;

  const closingMonthQuery = useQuery({
    queryKey: ['closing-month', selectedYear],
    queryFn: () => backend.getClosingMonth(apiFetch, selectedYear),
    enabled: Number.isFinite(selectedYear),
  });

  const selectedMonth = Math.max(1, Math.min(12, closingMonthQuery.data?.closingMonth ?? 1));
  const activeMonth = Number.isFinite(monthFromQuery)
    ? Math.max(1, Math.min(12, monthFromQuery))
    : selectedMonth;
  const periodShort = monthNames[activeMonth - 1].toLowerCase();

  const replaceQuery = (nextYear: number, nextMonth: number) => {
    router.replace(`/dre/analises?year=${nextYear}&month=${nextMonth}`);
  };

  const accumulatedQuery = useQuery({
    queryKey: ['dre-analises-accumulated', selectedYear, activeMonth],
    queryFn: () => backend.getDreExerciseAccumulated(apiFetch, selectedYear, activeMonth),
    enabled: Number.isFinite(selectedYear),
  });

  const monthlyQuery = useQuery({
    queryKey: ['dre-analises-monthly', selectedYear, activeMonth],
    queryFn: () => backend.getDreExerciseMonthly(apiFetch, selectedYear, activeMonth),
    enabled: Number.isFinite(selectedYear),
  });

  const budgetByYear = useMemo(() => {
    const readyBudgets = budgets.filter((budget) => budget.kind === 'BUDGET' && budget.status === 'READY');
    const pickLatest = (targetYear: number) =>
      readyBudgets
        .filter((budget) => budget.year === targetYear)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    return {
      previous: pickLatest(previousYear),
      current: pickLatest(selectedYear),
    };
  }, [budgets, previousYear, selectedYear]);

  const projectedCurrentTreeQuery = useQuery({
    queryKey: ['dre-analises-projected-current-tree', selectedYear, budgetByYear.current?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.current!.id, 'DRE'),
    enabled: Boolean(budgetByYear.current?.id),
  });

  const projectedPreviousTreeQuery = useQuery({
    queryKey: ['dre-analises-projected-previous-tree', previousYear, budgetByYear.previous?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.previous!.id, 'DRE'),
    enabled: Boolean(budgetByYear.previous?.id),
  });

  const variationRows = useMemo(
    () =>
      buildVariationRows(
        projectedCurrentTreeQuery.data?.rows ?? [],
        projectedPreviousTreeQuery.data?.rows ?? [],
        selectedYear,
        previousYear,
        activeMonth,
      ),
    [projectedCurrentTreeQuery.data?.rows, projectedPreviousTreeQuery.data?.rows, selectedYear, previousYear, activeMonth],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-2 2xl:px-4">
      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-4 p-5">
          <PageHeader
            title="Analises DRE"
            description="Comparativo em tres visoes: Acumulado, Mensal e Variacao."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(selectedYear)}
                  onValueChange={(value) => replaceQuery(Number(value), activeMonth)}
                >
                  <SelectTrigger className="h-10 w-[150px] border-border/70 bg-[color:var(--surface-1)] shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(activeMonth)}
                  onValueChange={(value) => replaceQuery(selectedYear, Number(value))}
                >
                  <SelectTrigger className="h-10 w-[150px] border-border/70 bg-[color:var(--surface-1)] shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        Mes {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className="h-10 border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 text-[color:var(--accent)]">
                  Mes fechado: {selectedMonth}
                </Badge>
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
              Tabela 1: Acumulado
            </Badge>
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
              Tabela 2: Mensal
            </Badge>
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
              Tabela 3: Variacao
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Tabela Acumulado</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {accumulatedQuery.data ? (
            <ExerciseComparisonTable
              rows={accumulatedQuery.data.rows}
              previousLabel={`Acumulado ${previousYear} (jan-${periodShort})`}
              currentLabel={`Acumulado ${selectedYear} (jan-${periodShort})`}
            />
          ) : (
            <p className="rounded-xl border border-border/70 bg-[color:var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
              Carregando acumulado...
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Tabela Mensal</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {monthlyQuery.data ? (
            <ExerciseComparisonTable
              rows={monthlyQuery.data.rows}
              previousLabel={`Mensal ${previousYear} (${monthNames[activeMonth - 1]})`}
              currentLabel={`Mensal ${selectedYear} (${monthNames[activeMonth - 1]})`}
            />
          ) : (
            <p className="rounded-xl border border-border/70 bg-[color:var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
              Carregando mensal...
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Tabela Variacao (Orcado - Realizado)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!budgetByYear.previous || !budgetByYear.current ? (
            <p className="rounded-xl border border-amber-300/70 bg-amber-100/80 px-3 py-2 text-sm text-amber-700">
              Orcamento pronto nao encontrado para {previousYear} e/ou {selectedYear}.
            </p>
          ) : variationRows.length > 0 ? (
            <ExerciseComparisonTable
              rows={variationRows}
              previousLabel={`Variacao ${previousYear} (jan-${periodShort})`}
              currentLabel={`Variacao ${selectedYear} (jan-${periodShort})`}
            />
          ) : (
            <p className="rounded-xl border border-border/70 bg-[color:var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
              Carregando variacao...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
