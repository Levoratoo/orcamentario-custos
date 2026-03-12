'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogClose,
  DialogContentPlain,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrencyBRL } from '@/lib/formatters';
import { useDre } from '@/hooks/use-dre';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Budget } from '@/lib/types';
import { getCollapsedRootRows } from '@/services/dre/collapsed-structure';

type DialogDreMode = 'ORCADO' | 'REALIZADO' | 'DRE';

interface DreDialogProps {
  defaultBudgetId?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function buildBudgetLabel(budget: Budget, yearCounts: Map<number, number>) {
  const count = yearCounts.get(budget.year) ?? 0;
  const suffix = count > 1 ? ` (v${budget.version})` : '';
  return `${budget.name} (${budget.year})${suffix}`;
}

function calcVariation(orcado: number, realizado: number) {
  const value = orcado - realizado;
  const pctBase = Math.abs(orcado);
  const pct = pctBase > 0 ? (value / pctBase) * 100 : null;
  return { value, pct };
}

function formatSignedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toFixed(1).replace('.', ',')}%`;
}

function variationDirectionLabel(value: number) {
  if (value < 0) return 'subiu';
  if (value > 0) return 'diminuiu';
  return 'estavel';
}

function variationValueClass(value: number) {
  if (value < 0) return 'text-rose-600 dark:text-rose-300';
  if (value > 0) return 'text-blue-700 dark:text-sky-300';
  return 'text-foreground';
}

function variationMetaClass(value: number) {
  if (value < 0) return 'text-rose-500 dark:text-rose-300/90';
  if (value > 0) return 'text-blue-600 dark:text-sky-300/90';
  return 'text-muted-foreground';
}

export function DreDialog({ defaultBudgetId, open: openProp, onOpenChange }: DreDialogProps) {
  const { apiFetch } = useApiClient();
  const [mode, setMode] = useState<DialogDreMode>('DRE');
  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch) });
  const readyBudgetsAll = useMemo(() => budgets.filter((budget) => budget.status === 'READY'), [budgets]);
  const readyBudgets = useMemo(
    () =>
      readyBudgetsAll
        .filter((budget) => budget.kind === 'BUDGET')
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          if (a.version !== b.version) return a.version - b.version;
          return a.name.localeCompare(b.name, 'pt-BR');
        }),
    [readyBudgetsAll],
  );
  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>();
    readyBudgets.forEach((budget) => {
      counts.set(budget.year, (counts.get(budget.year) ?? 0) + 1);
    });
    return counts;
  }, [readyBudgets]);

  const defaultBudget = readyBudgets.find((budget) => budget.isActive) ?? readyBudgets[0] ?? null;
  const initialBudgetId = defaultBudgetId ?? defaultBudget?.id ?? null;
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(initialBudgetId);
  const lastDefaultBudgetIdRef = useRef<string | null | undefined>(defaultBudgetId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAllRoots, setShowAllRoots] = useState(false);
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setOpenInternal(next);
    }
    onOpenChange?.(next);
  };

  const activeBudget = readyBudgets.find((budget) => budget.id === activeBudgetId) ?? null;
  const actualBudget = activeBudget
    ? readyBudgetsAll.find((budget) => budget.year === activeBudget.year && budget.kind === 'ACTUAL')
    : null;
  const { rows, months, closingMonth, year } = useDre({
    budgetId: activeBudgetId,
    mode: 'dre',
    actualBudgetId: actualBudget?.id ?? null,
  });
  type TreeNode = (typeof rows)[number] & { children: TreeNode[] };
  const ensureRowsHierarchy = useCallback((inputRows: typeof rows) => {
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

    const deriveLevelFromCodigo = (codigo?: string) => {
      if (!codigo) return 0;
      const parts = String(codigo).split('.').filter(Boolean);
      return parts.length > 1 ? parts.length - 1 : 0;
    };
    const markerMatch = (descricao: string) => descricao.match(/^\s*\(([+-])\)\s*(.*)$/);
    const attachByLevel = (levels: number[]) => {
      const seenById = new Map<string, number>();
      const stack: Array<{ id: string; level: number }> = [];
      return inputRows.map((row, index) => {
        const baseId = String(row.id ?? row.codigo ?? row.descricao ?? 'row');
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
        return {
          ...row,
          id: uniqueId,
          nivel: level,
          parentId,
        };
      });
    };

    const explicitLevels = inputRows.map((row) => Number(row.nivel ?? 0));
    const hasNestedLevel = explicitLevels.some((level) => Number.isFinite(level) && level > 0);
    const baseLevels = hasNestedLevel
      ? explicitLevels
      : inputRows.map((row) => deriveLevelFromCodigo(row.codigo));
    const normalized = attachByLevel(baseLevels);

    const roots = normalized.filter((row) => !row.parentId).length;
    const tooFlat = roots / Math.max(normalized.length, 1) > 0.6;
    const byId = new Map(normalized.map((row) => [row.id, row]));
    const hasInvalidMarkerGrouping = normalized.some((row) => {
      const marker = markerMatch(String(row.descricao ?? ''));
      if (!marker) return false;
      if ((row.nivel ?? 0) > 1) return true;
      if (!row.parentId) return false;
      const parent = byId.get(row.parentId);
      if (!parent) return true;
      return !markerMatch(String(parent.descricao ?? ''));
    });
    if (!tooFlat && !hasInvalidMarkerGrouping) return normalized;

    // Fallback for flat payloads: derive hierarchy from accounting markers.
    const deducoesIndex = inputRows.findIndex((row) => {
      const text = String(row.descricao ?? '');
      const marker = markerMatch(text);
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
          fallbackLevels.push(0); // (-) DEDUCOES
          return;
        }
        minusGroupCreated = true;
        fallbackLevels.push(1); // (-) subgroups under DEDUCOES
        return;
      }

      fallbackLevels.push(minusGroupCreated ? 2 : minusRootCreated ? 1 : 0);
    });

    return attachByLevel(fallbackLevels);
  }, []);

  const treeData = useMemo<{ rootRows: TreeNode[] }>(() => {
    if (rows.length === 0) return { rootRows: [] };
    const withParent = ensureRowsHierarchy(rows);

    const byId = new Map<string, TreeNode>();
    withParent.forEach((row) => {
      byId.set(row.id, { ...row, children: [] });
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
  }, [rows, ensureRowsHierarchy]);
  const treeRows = treeData.rootRows;

  const collapsedRootRows = useMemo<TreeNode[]>(() => getCollapsedRootRows(treeRows), [treeRows]);

  const displayRootRows = useMemo(() => {
    if (showAllRoots) return treeRows;
    // If mapping fails for any reason, fallback to current roots.
    return collapsedRootRows.length > 0 ? collapsedRootRows : treeRows;
  }, [collapsedRootRows, treeRows, showAllRoots]);
  const rowsKey = useMemo(() => {
    const collectIds = (nodes: TreeNode[], acc: string[] = []) => {
      nodes.forEach((node) => {
        acc.push(node.id);
        if (node.children.length) collectIds(node.children, acc);
      });
      return acc;
    };
    return collectIds(treeRows).join('|');
  }, [treeRows]);
  const datasetKey = useMemo(
    () => `${activeBudgetId ?? 'none'}|${activeBudget?.year ?? 'none'}|${rowsKey}|${months.join(',')}`,
    [activeBudgetId, activeBudget?.year, rowsKey, months],
  );
  const buildColumns = useCallback((activeMode: DialogDreMode, monthKeys: string[]) => {
    const monthColumns = monthKeys.map((month) => {
      const [year, mm] = month.split('-');
      return {
        key: month,
        label: `${mm}/${year}`,
        colSpan: activeMode === 'DRE' ? 3 : 1,
      };
    });
    return {
      monthColumns,
      totalColSpan: activeMode === 'DRE' ? 3 : 1,
      isFullDre: activeMode === 'DRE',
    };
  }, []);

  const columns = useMemo(() => buildColumns(mode, months), [buildColumns, mode, months]);

  const toggleRow = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, [setExpanded]);

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length) {
          all[node.id] = true;
          walk(node.children);
        }
      });
    };
    walk(treeRows);
    setShowAllRoots(true);
    setExpanded(all);
  }, [treeRows, setExpanded]);

  const collapseAll = useCallback(() => {
    setShowAllRoots(false);
    setExpanded({});
  }, [setExpanded]);

  useEffect(() => {
    // Sync with external selection only when it actually changes,
    // so tab clicks keep working inside the dialog.
    if (defaultBudgetId && defaultBudgetId !== lastDefaultBudgetIdRef.current) {
      setActiveBudgetId(defaultBudgetId);
    } else if (!activeBudgetId && defaultBudget) {
      setActiveBudgetId(defaultBudget.id);
    }
    lastDefaultBudgetIdRef.current = defaultBudgetId;
  }, [defaultBudgetId, activeBudgetId, defaultBudget]);

  useEffect(() => {
    // DRE must always open 100% collapsed.
    if (open) {
      setShowAllRoots(false);
      setExpanded({});
    }
  }, [open]);

  useEffect(() => {
    // Dataset change must always reset expansion state.
    setShowAllRoots(false);
    setExpanded({});
  }, [datasetKey]);

  const hasData = displayRootRows.length > 0;

  const visibleRows = useMemo(() => {
    const out: Array<{ node: TreeNode; depth: number }> = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((node) => {
        out.push({ node, depth });
        if (expanded[node.id] && node.children.length) {
          walk(node.children, depth + 1);
        }
      });
    };
    walk(displayRootRows, 0);
    return out;
  }, [displayRootRows, expanded]);

  const homonymCountByLabel = useMemo(() => {
    const normalize = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = normalize(String(row.descricao ?? ''));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const modeOptions: Array<{ key: DialogDreMode; label: string }> = [
    { key: 'ORCADO', label: 'Orcado' },
    { key: 'REALIZADO', label: 'Realizado' },
    { key: 'DRE', label: 'DRE' },
  ];

  const getMonthValueByMode = useCallback(
    (value: { previsto?: number; realizado?: number; projetado?: number } | undefined, activeMode: DialogDreMode) => {
      if (activeMode === 'ORCADO') return value?.previsto ?? 0;
      if (activeMode === 'REALIZADO') return value?.realizado ?? 0;
      return value?.previsto ?? 0;
    },
    [],
  );

  const closingMonthLabel = useMemo(() => {
    if (!closingMonth || closingMonth <= 0) return 'Mes fechado: nenhum';
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthText = monthNames[Math.max(0, Math.min(11, closingMonth - 1))];
    const displayYear = year ?? activeBudget?.year ?? '';
    return `Mes fechado: ${monthText}/${displayYear}`;
  }, [closingMonth, year, activeBudget?.year]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-border/60 hover:bg-[color:var(--surface-2)] hover:text-foreground"
        >
          DRE
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/60" />
        <DialogContentPlain className="p-0">
          <Tabs value={activeBudgetId ?? ''} onValueChange={setActiveBudgetId} className="dreOverlay">
            <div className="dreModal" role="dialog" aria-modal="true">
              <div className="dreHeader">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DialogTitle>Demonstracao do Resultado do Exercicio</DialogTitle>
                  <DialogClose asChild>
                    <Button variant="ghost">Voltar</Button>
                  </DialogClose>
                </div>
                <div className="mt-3 grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
                  <TabsList className="justify-self-start">
                    {readyBudgets.map((budget) => (
                      <TabsTrigger key={budget.id} value={budget.id}>
                        {buildBudgetLabel(budget, yearCounts)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="flex items-center gap-1 justify-self-center">
                    {modeOptions.map((item) => (
                      <Button
                        key={item.key}
                        type="button"
                        size="sm"
                        variant={mode === item.key ? 'default' : 'outline'}
                        className={mode === item.key ? '' : 'border-transparent'}
                        onClick={() => setMode(item.key)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground justify-self-end">
                    <Button variant="outline" size="sm" onClick={expandAll}>
                      Expandir tudo
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>
                      Recolher tudo
                    </Button>
                    <span>Modo: {mode}</span>
                    <span>{closingMonthLabel}</span>
                  </div>
                </div>
              </div>
              <div className="dreBody" tabIndex={0}>
                <TabsContent key={activeBudgetId ?? 'dre'} value={activeBudgetId ?? ''} className="min-h-0 min-w-0">
                  {hasData ? (
                    <div>
                      <div className="dreTableWrap">
                        <table className="dreTable">
                        <thead>
                          <tr>
                            <th className="dreCorner dreHeadMainCorner">Conta Contabil</th>
                            {columns.monthColumns.map((group) => (
                              <th key={`group-${group.label}`} colSpan={group.colSpan} className="dreGroup dreHeadMain">
                                {group.label}
                              </th>
                            ))}
                            <th className="dreGroup dreHeadMain" colSpan={columns.totalColSpan}>
                              Total
                            </th>
                          </tr>
                          {columns.isFullDre && (
                            <tr>
                              <th className="dreCorner dreHeadSubCorner">&nbsp;</th>
                              {months.flatMap((monthKey) => ([
                                <th key={`${monthKey}-previsto`} className="dreSubHead dreHeadSub">Orcado</th>,
                                <th key={`${monthKey}-realizado`} className="dreSubHead dreHeadSub">Realizado</th>,
                                <th key={`${monthKey}-variacao`} className="dreSubHead dreHeadSub">Variacao</th>,
                              ]))}
                              <th className="dreSubHead dreHeadSub">Orcado</th>
                              <th className="dreSubHead dreHeadSub">Realizado</th>
                              <th className="dreSubHead dreHeadSub">Variacao</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {visibleRows.map(({ node, depth }) => {
                            const hasChildren = node.children.length > 0;
                            const isExpanded = Boolean(expanded[node.id]);
                            const rowKey = `${node.parentId ?? 'root'}:${node.id}`;
                            const normalizedLabel = String(node.descricao ?? '')
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .toUpperCase()
                              .replace(/\s+/g, ' ')
                              .trim();
                            const isHomonym = (homonymCountByLabel.get(normalizedLabel) ?? 0) > 1;
                            const visualId = String(node.codigo ?? node.id);
                            const rowHoverLabel = `${String(node.descricao ?? '')} • ${visualId}`;
                            const totals = months.reduce(
                              (acc, monthKey) => {
                                const value = node.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
                                acc.previsto += value.previsto ?? 0;
                                acc.realizado += value.realizado ?? 0;
                                return acc;
                              },
                              { previsto: 0, realizado: 0 },
                            );
                            return (
                              <tr
                                key={rowKey}
                                className={
                                  hasChildren
                                    ? depth === 0
                                      ? 'dreRowParent dreRowParentRoot'
                                      : 'dreRowParent'
                                    : undefined
                                }
                              >
                                <td className="dreSticky">
                                  <div className={`dreLabel ${depth <= 1 ? 'dreLabelGroup' : ''}`} style={{ paddingLeft: `${depth * 14}px` }}>
                                    {hasChildren ? (
                                      <button type="button" className="dreToggle" onClick={() => toggleRow(node.id)}>
                                        {isExpanded ? '-' : '+'}
                                      </button>
                                    ) : (
                                      <span className="dreTogglePlaceholder" />
                                    )}
                                    <span className="dreLabelText" title={rowHoverLabel}>{node.descricao}</span>
                                    {isHomonym && (
                                      <span
                                        className="dreHomonymBadge"
                                        title={`Código ${visualId} — Existem outras contas com o mesmo nome "${node.descricao}", este código identifica qual é esta.`}
                                      >
                                        {visualId}
                                      </span>
                                    )}
                                    {hasChildren && depth >= 1 && (
                                      <span className="ml-2 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        {node.children.length} itens
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {columns.isFullDre
                                  ? months.map((monthKey, monthIndex) => {
                                      const value = node.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
                                      const variation = calcVariation(value.previsto ?? 0, value.realizado ?? 0);
                                      return (
                                        <Fragment key={`${node.id}-${monthIndex}-group`}>
                                          <td className="dreValue">{formatCurrencyBRL(value.previsto ?? 0)}</td>
                                          <td className="dreValue">{formatCurrencyBRL(value.realizado ?? 0)}</td>
                                          <td className="dreValue">
                                            <div className={variationValueClass(variation.value)}>
                                              {formatCurrencyBRL(variation.value)}
                                            </div>
                                            <div className={`text-[10px] ${variationMetaClass(variation.value)}`}>
                                              {`${formatSignedPercent(variation.pct)} ${variationDirectionLabel(variation.value)}`}
                                            </div>
                                          </td>
                                        </Fragment>
                                      );
                                    })
                                  : months.map((monthKey) => {
                                      const value = node.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
                                      return (
                                        <td key={`${node.id}-${monthKey}-${mode}`} className="dreValue">
                                          {formatCurrencyBRL(getMonthValueByMode(value, mode))}
                                        </td>
                                      );
                                    })}
                                {columns.isFullDre ? (
                                  <>
                                    <td className="dreValue">{formatCurrencyBRL(totals.previsto)}</td>
                                    <td className="dreValue">{formatCurrencyBRL(totals.realizado)}</td>
                                    <td className="dreValue">
                                      {(() => {
                                        const totalVariation = calcVariation(totals.previsto, totals.realizado);
                                        return (
                                          <>
                                            <div
                                              className={variationValueClass(totalVariation.value)}
                                            >
                                              {formatCurrencyBRL(totalVariation.value)}
                                            </div>
                                            <div className={`text-[10px] ${variationMetaClass(totalVariation.value)}`}>
                                              {`${formatSignedPercent(totalVariation.pct)} ${variationDirectionLabel(totalVariation.value)}`}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </td>
                                  </>
                                ) : (
                                  <td className="dreValue">{formatCurrencyBRL(getMonthValueByMode(totals, mode))}</td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sem dados do DRE para este ano.
                    </div>
                  )}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </DialogContentPlain>
      </DialogPortal>
    </Dialog>
  );
}
