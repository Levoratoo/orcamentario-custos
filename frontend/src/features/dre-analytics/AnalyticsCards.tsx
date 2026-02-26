'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { backend, DreExerciseAccumulatedResponse, DreExerciseMonthlyResponse, DreTreeResponse } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCollapsedRootRows } from '@/services/dre/collapsed-structure';

type AnalyticsCardsProps = {
  year: number;
  month: number;
};

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
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

function toMonthKey(year: number, month: number) {
  return `${year}-${String(Math.max(1, Math.min(12, month))).padStart(2, '0')}`;
}

function accumulatedToMonth(
  year: number,
  month: number,
  values: Record<string, number> | undefined,
) {
  if (!values) return 0;
  let total = 0;
  for (let cursor = 1; cursor <= month; cursor += 1) {
    total += values[toMonthKey(year, cursor)] ?? 0;
  }
  return total;
}

function formatRatioPct(current: number, previous: number) {
  if (previous === 0) return null;
  return current / previous;
}

type ExerciseRow = NonNullable<DreExerciseAccumulatedResponse['rows']>[number];
type TreeRow = DreTreeResponse['rows'][number];

function normalizeHierarchyRows(inputRows: ExerciseRow[]) {
  if (inputRows.length === 0) return inputRows;
  const idSet = new Set(inputRows.map((row) => String(row.id)));
  const hasExplicitParent = inputRows.some((row) => Boolean(row.parentId));
  const missingExplicitParents = inputRows.filter((row) => row.parentId && !idSet.has(String(row.parentId))).length;
  if (hasExplicitParent && missingExplicitParents === 0) {
    return inputRows.map((row) => ({
      ...row,
      id: String(row.id),
      parentId: row.parentId ? String(row.parentId) : null,
      nivel: Number.isFinite(Number(row.nivel)) ? Number(row.nivel) : 0,
    }));
  }

  const normalizeLabel = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  const deriveLevelFromCodigo = (codigo?: string | null) => {
    if (!codigo) return 0;
    const parts = String(codigo).split('.').filter(Boolean);
    return parts.length > 1 ? parts.length - 1 : 0;
  };
  const markerMatch = (descricao: string) => descricao.match(/^\s*\(([+\-=]|[+]\/*[-])\)\s*(.*)$/);

  const attachByLevel = (levels: number[]) => {
    const seenById = new Map<string, number>();
    const stack: Array<{ id: string; level: number }> = [];
    return inputRows.map((row, index) => {
      const baseId = String(row.id ?? row.codigo ?? row.descricao ?? `row-${index}`);
      const seen = seenById.get(baseId) ?? 0;
      seenById.set(baseId, seen + 1);
      const uniqueId = seen === 0 ? baseId : `${baseId}__${seen}`;
      const rawLevel = levels[index] ?? 0;
      const level = Number.isFinite(rawLevel) && rawLevel > 0 ? rawLevel : 0;

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parentId = level > 0 ? stack[stack.length - 1]?.id ?? null : null;
      stack.push({ id: uniqueId, level });
      return { ...row, id: uniqueId, parentId, nivel: level };
    });
  };

  const explicitLevels = inputRows.map((row) => Number(row.nivel ?? 0));
  const hasNestedLevel = explicitLevels.some((level) => Number.isFinite(level) && level > 0);
  const baseLevels = hasNestedLevel ? explicitLevels : inputRows.map((row) => deriveLevelFromCodigo(row.codigo));
  const firstPass = attachByLevel(baseLevels);
  const roots = firstPass.filter((row) => !row.parentId).length;
  const tooFlat = roots / Math.max(firstPass.length, 1) > 0.6;
  const byId = new Map(firstPass.map((row) => [row.id, row]));
  const hasInvalidMarkerGrouping = firstPass.some((row) => {
    const marker = markerMatch(String(row.descricao ?? ''));
    if (!marker) return false;
    if ((row.nivel ?? 0) > 1) return true;
    if (!row.parentId) return false;
    const parent = byId.get(row.parentId);
    if (!parent) return true;
    return !markerMatch(String(parent.descricao ?? ''));
  });
  if (!tooFlat && !hasInvalidMarkerGrouping) return firstPass;

  const deducoesIndex = inputRows.findIndex((row) => {
    const marker = markerMatch(String(row.descricao ?? ''));
    return marker?.[1] === '-' && normalizeLabel(marker?.[2] ?? '').includes('DEDUCOES');
  });

  const fallbackLevels: number[] = [];
  let hasRootMarker = false;
  let minusRootCreated = false;
  let minusGroupCreated = false;

  inputRows.forEach((row, index) => {
    const marker = markerMatch(String(row.descricao ?? ''));
    const inMinusBlock = deducoesIndex >= 0 && index >= deducoesIndex;

    if (!inMinusBlock) {
      if (marker) {
        hasRootMarker = true;
        fallbackLevels.push(0);
        return;
      }
      fallbackLevels.push(hasRootMarker ? 1 : 0);
      return;
    }

    if (marker?.[1] === '-') {
      if (!minusRootCreated) {
        minusRootCreated = true;
        minusGroupCreated = true;
        fallbackLevels.push(0);
        return;
      }
      minusGroupCreated = true;
      fallbackLevels.push(1);
      return;
    }

    fallbackLevels.push(minusGroupCreated ? 2 : minusRootCreated ? 1 : 0);
  });

  return attachByLevel(fallbackLevels);
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

function sumProjectedYear(row: TreeRow) {
  return Object.values(row.valoresPorMes ?? {}).reduce((sum, month) => sum + (month.projetado ?? month.realizado + month.previsto), 0);
}

function exerciseValueSignature(row: Pick<ExerciseRow, 'currentValue' | 'previousValue' | 'deltaValue'>) {
  return `${Number(row.currentValue ?? 0)}|${Number(row.previousValue ?? 0)}|${Number(row.deltaValue ?? 0)}`;
}

function removeNestedExerciseDuplicates(rows: ExerciseRow[]) {
  const rootKeys = new Set<string>();
  rows.forEach((row) => {
    if (row.parentId) return;
    const key = `${normalizeLabelKey(row.descricao)}|${exerciseValueSignature(row)}`;
    rootKeys.add(key);
  });

  return rows.filter((row) => {
    if (!row.parentId) return true;
    const key = `${normalizeLabelKey(row.descricao)}|${exerciseValueSignature(row)}`;
    return !rootKeys.has(key);
  });
}

function treeValueSignature(row: Pick<TreeRow, 'valoresPorMes'>) {
  const months = Object.keys(row.valoresPorMes ?? {}).sort();
  return months
    .map((monthKey) => {
      const values = row.valoresPorMes?.[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      const previsto = Number(values.previsto ?? 0);
      const realizado = Number(values.realizado ?? 0);
      const projetado = Number(values.projetado ?? values.realizado + values.previsto);
      return `${monthKey}:${previsto}|${realizado}|${projetado}`;
    })
    .join(';');
}

function removeNestedTreeDuplicates(rows: TreeRow[]) {
  const rootKeys = new Set<string>();
  rows.forEach((row) => {
    if (row.parentId) return;
    const key = `${normalizeLabelKey(row.descricao)}|${treeValueSignature(row)}`;
    rootKeys.add(key);
  });

  return rows.filter((row) => {
    if (!row.parentId) return true;
    const key = `${normalizeLabelKey(row.descricao)}|${treeValueSignature(row)}`;
    return !rootKeys.has(key);
  });
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(value)}`;
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value > 0;
  const neutral = value === 0;
  return (
    <Badge
      variant="outline"
      className={
        neutral
          ? 'border-border/70 bg-[color:var(--surface-2)] text-muted-foreground'
          : positive
            ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
            : 'border-rose-300/70 bg-rose-500/10 text-rose-500'
      }
    >
      {positive ? '+' : ''}
      {formatCurrency(value)}
    </Badge>
  );
}

function ExerciseTableCard({
  title,
  subtitle,
  compareLabel,
  loading,
  data,
  href,
}: {
  title: string;
  subtitle: string;
  compareLabel: string;
  loading: boolean;
  data?: DreExerciseAccumulatedResponse | DreExerciseMonthlyResponse;
  href?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAllRoots, setShowAllRoots] = useState(false);
  const rows = useMemo<ExerciseRow[]>(
    () => removeNestedExerciseDuplicates(normalizeHierarchyRows(data?.rows ?? [])),
    [data?.rows],
  );
  type TreeNode = ExerciseRow & { children: TreeNode[] };
  const treeData = useMemo<{ rootRows: TreeNode[] }>(() => {
    if (rows.length === 0) return { rootRows: [] };
    const byId = new Map<string, TreeNode>();
    rows.forEach((row) => {
      byId.set(String(row.id), { ...row, id: String(row.id), children: [] });
    });
    const roots: TreeNode[] = [];
    byId.forEach((node) => {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return { rootRows: roots };
  }, [rows]);
  const treeRows = treeData.rootRows;
  const collapsedRootRows = useMemo<TreeNode[]>(() => getCollapsedRootRows(treeRows), [treeRows]);
  const displayRootRows = useMemo(() => {
    if (showAllRoots) return treeRows;
    return collapsedRootRows.length > 0 ? collapsedRootRows : treeRows;
  }, [collapsedRootRows, treeRows, showAllRoots]);

  const visibleRows = useMemo(() => {
    const out: Array<{ row: TreeNode; depth: number; hasChildren: boolean }> = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((row) => {
        const hasChildren = row.children.length > 0;
        out.push({ row, depth, hasChildren });
        if (hasChildren && expanded[String(row.id)]) {
          walk(row.children, depth + 1);
        }
      });
    };
    walk(displayRootRows, 0);
    return out;
  }, [displayRootRows, expanded]);

  const expandableRowIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          ids.push(String(node.id));
          walk(node.children);
        }
      });
    };
    walk(treeRows);
    return ids;
  }, [treeRows]);
  const hasExpandableRows = expandableRowIds.length > 0;
  const allExpanded = hasExpandableRows && expandableRowIds.every((id) => Boolean(expanded[id]));

  const detailSummary = useMemo(() => {
    const positiveRows = rows.filter((row) => row.deltaValue > 0);
    const negativeRows = rows.filter((row) => row.deltaValue < 0);
    const strongestUp = [...positiveRows].sort((left, right) => right.deltaValue - left.deltaValue)[0] ?? null;
    const strongestDown = [...negativeRows].sort((left, right) => left.deltaValue - right.deltaValue)[0] ?? null;
    const absoluteImpact = rows.reduce((sum, row) => sum + Math.abs(row.deltaValue), 0);
    return {
      positiveCount: positiveRows.length,
      negativeCount: negativeRows.length,
      strongestUp,
      strongestDown,
      absoluteImpact,
    };
  }, [rows]);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    expandableRowIds.forEach((id) => {
      next[id] = true;
    });
    setShowAllRoots(true);
    setExpanded(next);
  };

  const collapseAll = () => {
    setShowAllRoots(false);
    setExpanded({});
  };

  useEffect(() => {
    setShowAllRoots(false);
    setExpanded({});
  }, [rows]);

  return (
    <Card className="group relative min-h-[720px] overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{title}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
                {rows.length} linhas
              </Badge>
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                +{detailSummary.positiveCount} favoraveis
              </Badge>
              <Badge className="border border-rose-300/70 bg-rose-500/10 text-rose-500">
                {detailSummary.negativeCount} desfavoraveis
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
              Impacto {formatCompactCurrency(detailSummary.absoluteImpact)}
            </Badge>
            {href ? (
              <Button
                asChild
                size="sm"
                className="h-9 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent)] px-4 text-white shadow-sm hover:bg-[color:var(--accent-2)]"
              >
                <Link href={href}>Abrir</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/92 p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Atual</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(data?.totals.currentValue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/92 p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Anterior</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(data?.totals.previousValue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/92 p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Delta</p>
            <div className="mt-1 flex items-center gap-2">
              <DeltaBadge value={data?.totals.deltaValue ?? 0} />
              <span className="text-xs text-muted-foreground">{formatPercent(data?.totals.deltaPct ?? null)}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/92 p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Destaques</p>
            <div className="mt-1 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">Maior alta</span>
                <span className="font-medium text-[color:var(--accent)]">
                  {detailSummary.strongestUp ? formatCompactCurrency(detailSummary.strongestUp.deltaValue) : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">Maior queda</span>
                <span className="font-medium text-rose-500">
                  {detailSummary.strongestDown ? formatCompactCurrency(detailSummary.strongestDown.deltaValue) : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 shadow-inner shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 bg-[color:var(--surface-2)]/70 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--accent)]">Estrutura DRE</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-full border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-[color:var(--surface-2)] hover:text-foreground"
                onClick={expandAll}
                disabled={loading || !hasExpandableRows || allExpanded}
              >
                Expandir tudo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-full border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-[color:var(--surface-2)] hover:text-foreground"
                onClick={collapseAll}
                disabled={loading || !hasExpandableRows}
              >
                Recolher tudo
              </Button>
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[10px] text-[color:var(--accent)]">
                {compareLabel}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">Carregando dados...</div>
          ) : visibleRows.length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">Sem dados para o periodo selecionado.</div>
          ) : (
            <div className="max-h-[460px] overflow-auto">
              <Table>
              <TableHeader className="sticky top-0 z-10 bg-[color:var(--surface-3)]/95 ">
                <TableRow className="border-border/70 hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Conta</TableHead>
                  <TableHead className="h-9 px-3 text-right text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Atual</TableHead>
                  <TableHead className="h-9 px-3 text-right text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Anterior</TableHead>
                  <TableHead className="h-9 px-3 text-right text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(({ row, depth, hasChildren }, index) => (
                  <TableRow
                    key={row.id}
                    className={
                      index % 2 === 0
                        ? 'border-border/40 bg-[color:var(--surface-1)]/92 hover:bg-[color:var(--accent-soft)]/35'
                        : 'border-border/40 bg-[color:var(--surface-2)]/74 hover:bg-[color:var(--accent-soft)]/35'
                    }
                  >
                    <TableCell className="max-w-[460px] truncate px-3 text-sm text-foreground">
                      <div className={depth <= 1 ? 'flex items-center gap-2 font-medium' : 'flex items-center gap-2'} style={{ paddingLeft: `${depth * 14}px` }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[11px] text-[color:var(--accent)]"
                            onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                          >
                            {expanded[row.id] ? '-' : '+'}
                          </button>
                        ) : (
                          <span className="inline-block h-5 w-5" />
                        )}
                        <span>{row.descricao}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 text-right text-sm text-foreground">{formatCurrency(row.currentValue)}</TableCell>
                    <TableCell className="px-3 text-right text-sm text-[color:var(--text-secondary)]">{formatCurrency(row.previousValue)}</TableCell>
                    <TableCell className="px-3 text-right text-sm">
                      <span className={row.deltaValue >= 0 ? 'text-[color:var(--accent-2)]' : 'text-rose-400'}>
                        {row.deltaValue >= 0 ? '+' : ''}
                        {formatCurrency(row.deltaValue)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsCards({ year, month }: AnalyticsCardsProps) {
  const { apiFetch } = useApiClient();
  const previousYear = year - 1;

  const accumulatedQuery = useQuery({
    queryKey: ['dre-analises-accumulated', year, month],
    queryFn: () => backend.getDreExerciseAccumulated(apiFetch, year, month),
    enabled: Number.isFinite(year) && Number.isFinite(month),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const monthlyQuery = useQuery({
    queryKey: ['dre-analises-monthly', year, month],
    queryFn: () => backend.getDreExerciseMonthly(apiFetch, year, month),
    enabled: Number.isFinite(year) && Number.isFinite(month),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const budgetsQuery = useQuery({
    queryKey: ['dre-analises-budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });

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
    queryKey: ['dre-analises-tree', year, budgetByYear.current?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.current!.id, 'DRE'),
    enabled: Boolean(budgetByYear.current?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const previousTreeQuery = useQuery({
    queryKey: ['dre-analises-tree', previousYear, budgetByYear.previous?.id],
    queryFn: () => backend.getDreTree(apiFetch, budgetByYear.previous!.id, 'DRE'),
    enabled: Boolean(budgetByYear.previous?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const comparisonTotals = useMemo(() => {
    const current = currentTreeQuery.data?.grandTotals;
    const previous = previousTreeQuery.data?.grandTotals;
    const previousBudget = accumulatedToMonth(previousYear, month, previous?.previstoByMonth);
    const previousActual = accumulatedToMonth(previousYear, month, previous?.realizadoByMonth);
    const currentBudget = accumulatedToMonth(year, month, current?.previstoByMonth);
    const currentActual = accumulatedToMonth(year, month, current?.realizadoByMonth);
    return {
      previousBudget,
      previousActual,
      currentBudget,
      currentActual,
      actualRatio: formatRatioPct(currentActual, previousActual),
    };
  }, [currentTreeQuery.data, month, previousTreeQuery.data, previousYear, year]);

  const comparisonInsights = useMemo(() => {
    const actualDelta = comparisonTotals.currentActual - comparisonTotals.previousActual;
    const budgetDelta = comparisonTotals.currentBudget - comparisonTotals.previousBudget;
    const currentGap = comparisonTotals.currentActual - comparisonTotals.currentBudget;
    const previousGap = comparisonTotals.previousActual - comparisonTotals.previousBudget;
    return { actualDelta, budgetDelta, currentGap, previousGap };
  }, [comparisonTotals]);

  const projectedData = useMemo<DreExerciseAccumulatedResponse | undefined>(() => {
    const currentRows = removeNestedTreeDuplicates(currentTreeQuery.data?.rows ?? []);
    const previousRows = removeNestedTreeDuplicates(previousTreeQuery.data?.rows ?? []);
    if (currentRows.length === 0 && previousRows.length === 0) return undefined;

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
      lastClosedMonth: currentTreeQuery.data?.closingMonth ?? month,
      cutoffMonth: 12,
      totals: {
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      },
      rows: mergedRows,
    };
  }, [currentTreeQuery.data, month, previousTreeQuery.data, previousYear, year]);

  return (
    <div className="grid gap-5 xl:grid-cols-2 xl:items-stretch 2xl:gap-6">
      <Card className="xl:col-span-2 overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            Comparativo Orcado x Realizado ({previousYear} vs {year})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Acumulado de Jan ate {monthNames[Math.max(1, month) - 1]}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Orcado {previousYear}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(comparisonTotals.previousBudget)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Real {previousYear}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(comparisonTotals.previousActual)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Orcado {year}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(comparisonTotals.currentBudget)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Real {year}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatCurrency(comparisonTotals.currentActual)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Var % Real {year}/{previousYear}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatPercent(comparisonTotals.actualRatio)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Delta Real R$</p>
              <p className={comparisonInsights.actualDelta >= 0 ? 'mt-1 text-base font-semibold text-[color:var(--accent)]' : 'mt-1 text-base font-semibold text-rose-500'}>
                {comparisonInsights.actualDelta >= 0 ? '+' : ''}
                {formatCurrency(comparisonInsights.actualDelta)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Delta Orcado R$</p>
              <p className={comparisonInsights.budgetDelta >= 0 ? 'mt-1 text-base font-semibold text-[color:var(--accent)]' : 'mt-1 text-base font-semibold text-rose-500'}>
                {comparisonInsights.budgetDelta >= 0 ? '+' : ''}
                {formatCurrency(comparisonInsights.budgetDelta)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Gap Atual (Real - Orcado)</p>
              <p className={comparisonInsights.currentGap >= 0 ? 'mt-1 text-base font-semibold text-[color:var(--accent)]' : 'mt-1 text-base font-semibold text-rose-500'}>
                {comparisonInsights.currentGap >= 0 ? '+' : ''}
                {formatCurrency(comparisonInsights.currentGap)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/95 p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Gap {previousYear}</p>
              <p className={comparisonInsights.previousGap >= 0 ? 'mt-1 text-base font-semibold text-[color:var(--accent)]' : 'mt-1 text-base font-semibold text-rose-500'}>
                {comparisonInsights.previousGap >= 0 ? '+' : ''}
                {formatCurrency(comparisonInsights.previousGap)}
              </p>
            </div>
          </div>
          {budgetsQuery.isLoading || currentTreeQuery.isLoading || previousTreeQuery.isLoading ? (
            <p className="mt-3 rounded-xl border border-border/70 bg-[color:var(--surface-2)] px-3 py-2 text-xs text-muted-foreground">
              Carregando comparativo...
            </p>
          ) : null}
          {!budgetByYear.previous || !budgetByYear.current ? (
            <p className="mt-3 rounded-xl border border-amber-300/70 bg-amber-100/80 px-3 py-2 text-xs text-amber-700">
              Orcamento pronto nao encontrado para {previousYear} e/ou {year}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ExerciseTableCard
        title="Exercicio Acumulado"
        subtitle={`Valor realizado de Jan ate ${monthNames[Math.max(1, month) - 1]} - comparativo com ${year - 1}`}
        compareLabel={`${year - 1} x ${year}`}
        loading={accumulatedQuery.isLoading}
        data={accumulatedQuery.data}
        href={`/dre/exercicio-acumulado?year=${year}&cutoffMonth=${month}`}
      />

      <ExerciseTableCard
        title="Exercicio Mensal"
        subtitle={`Valor do mes fechado (${monthNames[Math.max(1, month) - 1]}) - comparativo com ${year - 1}`}
        compareLabel={`${monthNames[Math.max(1, month) - 1]}/${year}`}
        loading={monthlyQuery.isLoading}
        data={monthlyQuery.data}
        href={`/dre/exercicio-mensal?year=${year}&month=${month}`}
      />

      <div className="xl:col-span-2">
        <ExerciseTableCard
          title="Exercicio Projetado"
          subtitle={`Visao projetada do ano completo (${year}): realizado + orcado ate Dez - comparativo com ${year - 1}`}
          compareLabel={`${previousYear} x ${year} (Jan-Dez)`}
          loading={currentTreeQuery.isLoading || previousTreeQuery.isLoading}
          data={projectedData}
          href={`/dre/exercicio-projetado?year=${year}`}
        />
      </div>
    </div>
  );
}

