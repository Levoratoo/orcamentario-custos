'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DreExerciseRowResponse } from '@/services/backend';
import { getCollapsedRootRows } from '@/services/dre/collapsed-structure';

type Props = {
  rows: DreExerciseRowResponse[];
  previousLabel: string;
  currentLabel: string;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrencyNoDecimals(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return `${percentFormatter.format(value * 100)}%`;
}

export function ExerciseComparisonTable({ rows, previousLabel, currentLabel }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAllRoots, setShowAllRoots] = useState(false);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, DreExerciseRowResponse[]>();
    rows.forEach((row) => {
      const parent = row.parentId ?? null;
      const list = byParent.get(parent) ?? [];
      list.push(row);
      byParent.set(parent, list);
    });
    return byParent;
  }, [rows]);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    rows.forEach((row) => {
      if ((tree.get(row.id) ?? []).length > 0) {
        next[row.id] = true;
      }
    });
    setShowAllRoots(true);
    setExpanded(next);
  };

  const collapseAll = () => {
    setShowAllRoots(false);
    setExpanded({});
  };

  const rootRows = useMemo(() => tree.get(null) ?? [], [tree]);
  const collapsedRootRows = useMemo(() => getCollapsedRootRows(rootRows), [rootRows]);
  const displayRootRows = useMemo(() => {
    if (showAllRoots) return rootRows;
    return collapsedRootRows.length > 0 ? collapsedRootRows : rootRows;
  }, [showAllRoots, rootRows, collapsedRootRows]);

  useEffect(() => {
    setShowAllRoots(false);
    setExpanded({});
  }, [rows]);

  const visibleRows = useMemo(() => {
    const out: Array<{ row: DreExerciseRowResponse; depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = tree.get(parentId) ?? [];
      children.forEach((row) => {
        out.push({ row, depth });
        if (expanded[row.id]) {
          walk(row.id, depth + 1);
        }
      });
    };
    displayRootRows.forEach((row) => {
      out.push({ row, depth: 0 });
      if (expanded[row.id]) {
        walk(row.id, 1);
      }
    });
    return out;
  }, [tree, expanded, displayRootRows]);

  const summary = useMemo(() => {
    const positive = rows.filter((row) => row.deltaValue > 0).length;
    const negative = rows.filter((row) => row.deltaValue < 0).length;
    const neutral = rows.length - positive - negative;
    const hierarchyNodes = rows.filter((row) => (tree.get(row.id) ?? []).length > 0).length;
    return { positive, negative, neutral, hierarchyNodes };
  }, [rows, tree]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)] px-3 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:bg-[color:var(--surface-2)]"
              onClick={expandAll}
            >
              Expandir tudo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:bg-[color:var(--surface-2)]"
              onClick={collapseAll}
            >
              Recolher tudo
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border/70 bg-[color:var(--surface-1)] px-2.5 py-1 text-muted-foreground">
              {visibleRows.length} linhas visiveis
            </span>
            <span className="rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2.5 py-1 text-[color:var(--accent)]">
              {summary.hierarchyNodes} grupos
            </span>
            <span className="rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2.5 py-1 text-[color:var(--accent)]">
              +{summary.positive}
            </span>
            <span className="rounded-full border border-rose-300/70 bg-rose-500/10 px-2.5 py-1 text-rose-500">
              {summary.negative}
            </span>
            <span className="rounded-full border border-border/70 bg-[color:var(--surface-1)] px-2.5 py-1 text-muted-foreground">
              {summary.neutral} neutras
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[360px] border-b border-border/70 bg-[color:var(--surface-3)] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Conta Contabil</th>
              <th className="sticky top-0 z-20 border-b border-border/70 bg-[color:var(--surface-3)] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{previousLabel}</th>
              <th className="sticky top-0 z-20 border-b border-border/70 bg-[color:var(--surface-3)] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{currentLabel}</th>
              <th className="sticky top-0 z-20 border-b border-border/70 bg-[color:var(--surface-3)] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Delta R$</th>
              <th className="sticky top-0 z-20 border-b border-border/70 bg-[color:var(--surface-3)] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Delta %</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, depth }, index) => {
              const hasChildren = (tree.get(row.id) ?? []).length > 0;
              const isExpanded = Boolean(expanded[row.id]);
              const rowBackgroundClass =
                index % 2 === 0 ? 'bg-[color:var(--surface-1)]/92' : 'bg-[color:var(--surface-2)]/76';
              const stickyBackgroundClass =
                index % 2 === 0 ? 'bg-[color:var(--surface-1)]/96' : 'bg-[color:var(--surface-2)]/90';
              return (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-[color:var(--accent-soft)]/35 ${rowBackgroundClass}`}
                >
                  <td
                    className={`sticky left-0 z-10 border-b border-border/50 px-3 py-2 shadow-sm group-hover:bg-[color:var(--accent-soft)]/45 ${stickyBackgroundClass}`}
                  >
                    <div className={depth <= 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'} style={{ paddingLeft: depth * 14 }}>
                      {hasChildren ? (
                        <button
                          type="button"
                          className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[11px] text-[color:var(--accent)]"
                          onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                        >
                          {isExpanded ? '-' : '+'}
                        </button>
                      ) : (
                        <span className="mr-2 inline-block h-5 w-5" />
                      )}
                      {row.descricao}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-3 py-2 text-right text-foreground tabular-nums">{formatCurrencyNoDecimals(row.previousValue)}</td>
                  <td className="border-b border-border/50 px-3 py-2 text-right text-foreground tabular-nums">{formatCurrencyNoDecimals(row.currentValue)}</td>
                  <td className={`border-b border-border/50 px-3 py-2 text-right tabular-nums ${row.deltaValue >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}>
                    {formatCurrencyNoDecimals(row.deltaValue)}
                  </td>
                  <td
                    className={`border-b border-border/50 px-3 py-2 text-right tabular-nums ${row.deltaPct === null ? 'text-muted-foreground' : row.deltaPct >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}
                  >
                    {formatPercent(row.deltaPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

