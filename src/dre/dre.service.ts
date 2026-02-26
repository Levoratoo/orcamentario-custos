import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetKind, BudgetStatus, DreMode } from '@prisma/client';
import {
  computeDeltaMetrics,
  computeExerciseAccumulatedFromSeries,
  computeProjectedValue,
  computeRealizedAccumulatedFromSeries,
  computeRealizedMonthlyFromSeries,
  normalizeDreHierarchy,
  normalizeDreKey,
  sanitizeLabel,
  inspectDreHierarchy,
} from './dre-utils';
import { getDre2026SheetData, invalidateDre2026SheetCache } from './dre-2026-sheet';

const TREE_CACHE_TTL_MS = 30_000;
type TreeCacheEntry = { data: any; expiresAt: number };
const treeCache = new Map<string, TreeCacheEntry>();

function getTreeCached(key: string): any | null {
  const entry = treeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    treeCache.delete(key);
    return null;
  }
  return entry.data;
}

function setTreeCached(key: string, data: any): void {
  treeCache.set(key, { data, expiresAt: Date.now() + TREE_CACHE_TTL_MS });
  if (treeCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of treeCache) {
      if (now > v.expiresAt) treeCache.delete(k);
    }
  }
}

type DreTreeRow = {
  id: string;
  codigo?: string | null;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  pathId?: string | null;
  parentPathId?: string | null;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

type ExerciseComparableRow = {
  id: string;
  codigo?: string | null;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  pathId?: string | null;
  parentPathId?: string | null;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

type DreSheetHierarchyRow = {
  id: string;
  codigo?: string | null;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  sortOrder?: number;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

type DreNodeAudit = {
  id: string;
  codigo?: string | null;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  sortOrder: number;
  values: Record<number, number>;
};

@Injectable()
export class DreService {
  private readonly logger = new Logger(DreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getExerciseAccumulated(year: number, cutoffMonth?: number) {
    const { currentBudget, previousBudget } = await this.resolveComparisonBudgets(year);
    const currentTree = await this.getTree(currentBudget.id, 'DRE');
    const previousTree = previousBudget ? await this.getTree(previousBudget.id, 'DRE') : null;

    const lastClosedMonth = this.resolveLastClosedMonth(currentTree.closingMonth ?? 0);
    const defaultCutoff = Math.min(lastClosedMonth || new Date().getMonth(), 12);
    const resolvedCutoff = this.clampMonth(cutoffMonth ?? defaultCutoff ?? 1);

    const currentRows = this.ensureExerciseHierarchy(currentTree.rows as ExerciseComparableRow[]);
    const previousRows = previousTree
      ? this.ensureExerciseHierarchy(previousTree.rows as ExerciseComparableRow[])
      : [];

    const previousMap = previousTree
      ? this.indexRowsByCodeOrLabel(previousRows)
      : { byCode: new Map<string, DreTreeRow[]>(), byLabel: new Map<string, DreTreeRow[]>() };
    const baseRows = currentRows.map((row) => {
      const previousRow = this.findComparableRow(previousMap, row);
      const currentSeries = this.toMonthSeries(row, currentTree.year);
      const previousSeries = this.toMonthSeries(previousRow, previousTree?.year ?? year - 1);

      const currentValue = computeExerciseAccumulatedFromSeries(
        currentSeries.previsto,
        currentSeries.realizado,
        resolvedCutoff,
        lastClosedMonth,
      );
      const previousValue = computeRealizedAccumulatedFromSeries(previousSeries.realizado, resolvedCutoff);
      const { deltaValue, deltaPct } = computeDeltaMetrics(currentValue, previousValue);

      return {
        id: row.id,
        codigo: row.codigo ?? null,
        descricao: row.descricao,
        nivel: row.nivel,
        parentId: row.parentId ?? null,
        pathId: row.pathId ?? null,
        parentPathId: row.parentPathId ?? null,
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      };
    });

    const rows = this.rollupExerciseRows(baseRows);

    const rootRows = rows.filter((row) => !row.parentId);
    const totals = rootRows.reduce(
      (acc, row) => {
        acc.previousValue += row.previousValue;
        acc.currentValue += row.currentValue;
        return acc;
      },
      { previousValue: 0, currentValue: 0 },
    );
    const deltaTotals = computeDeltaMetrics(totals.currentValue, totals.previousValue);

    return {
      year,
      compareYear: previousTree?.year ?? year - 1,
      lastClosedMonth,
      cutoffMonth: resolvedCutoff,
      totals: {
        ...totals,
        deltaValue: deltaTotals.deltaValue,
        deltaPct: deltaTotals.deltaPct,
      },
      rows,
    };
  }

  async getExerciseMonthly(year: number, month?: number) {
    const { currentBudget, previousBudget } = await this.resolveComparisonBudgets(year);
    const currentTree = await this.getTree(currentBudget.id, 'DRE');
    const previousTree = previousBudget ? await this.getTree(previousBudget.id, 'DRE') : null;

    const lastClosedMonth = this.resolveLastClosedMonth(currentTree.closingMonth ?? 0);
    const fallbackMonth = lastClosedMonth || new Date().getMonth() || 1;
    const resolvedMonth = this.clampMonth(month ?? fallbackMonth);

    const currentRows = this.ensureExerciseHierarchy(currentTree.rows as ExerciseComparableRow[]);
    const previousRows = previousTree
      ? this.ensureExerciseHierarchy(previousTree.rows as ExerciseComparableRow[])
      : [];

    const previousMap = previousTree
      ? this.indexRowsByCodeOrLabel(previousRows)
      : { byCode: new Map<string, DreTreeRow[]>(), byLabel: new Map<string, DreTreeRow[]>() };
    const baseRows = currentRows.map((row) => {
      const previousRow = this.findComparableRow(previousMap, row);
      const currentSeries = this.toMonthSeries(row, currentTree.year);
      const previousSeries = this.toMonthSeries(previousRow, previousTree?.year ?? year - 1);

      const currentValue = computeRealizedMonthlyFromSeries(currentSeries.realizado, resolvedMonth);
      const previousValue = computeRealizedMonthlyFromSeries(previousSeries.realizado, resolvedMonth);
      const { deltaValue, deltaPct } = computeDeltaMetrics(currentValue, previousValue);

      return {
        id: row.id,
        codigo: row.codigo ?? null,
        descricao: row.descricao,
        nivel: row.nivel,
        parentId: row.parentId ?? null,
        pathId: row.pathId ?? null,
        parentPathId: row.parentPathId ?? null,
        previousValue,
        currentValue,
        deltaValue,
        deltaPct,
      };
    });

    const rows = this.rollupExerciseRows(baseRows);

    const rootRows = rows.filter((row) => !row.parentId);
    const totals = rootRows.reduce(
      (acc, row) => {
        acc.previousValue += row.previousValue;
        acc.currentValue += row.currentValue;
        return acc;
      },
      { previousValue: 0, currentValue: 0 },
    );
    const deltaTotals = computeDeltaMetrics(totals.currentValue, totals.previousValue);

    return {
      year,
      compareYear: previousTree?.year ?? year - 1,
      lastClosedMonth,
      month: resolvedMonth,
      totals: {
        ...totals,
        deltaValue: deltaTotals.deltaValue,
        deltaPct: deltaTotals.deltaPct,
      },
      rows,
    };
  }

  async getTree(budgetId: string, mode: string, actualBudgetId?: string) {
    const cacheKey = `${budgetId}:${mode}:${actualBudgetId ?? ''}`;
    const cached = getTreeCached(cacheKey);
    if (cached) return cached;

    const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
    }

    const resolvedMode = mode?.toUpperCase() ?? 'BUDGET';
    const [actualBudget, closingMonthRecord] = await Promise.all([
      actualBudgetId
        ? this.prisma.budget.findUnique({ where: { id: actualBudgetId } })
        : this.prisma.budget.findFirst({
            where: {
              year: budget.year,
              kind: BudgetKind.ACTUAL,
              status: BudgetStatus.READY,
            },
            orderBy: { updatedAt: 'desc' },
          }).then(async (found) =>
            found ??
            this.prisma.budget.findFirst({
              where: {
                year: budget.year,
                kind: BudgetKind.ACTUAL,
              },
              orderBy: { updatedAt: 'desc' },
            }),
          ),
      this.prisma.closingMonth.findUnique({
        where: { year_kind: { year: budget.year, kind: BudgetKind.ACTUAL } },
      }),
    ]);
    // TODO: replace DEV fallback with authoritative period-closure source.
    const devFallbackClosingMonth = Math.max(0, new Date().getMonth());
    const closingMonth = closingMonthRecord?.closingMonth ?? devFallbackClosingMonth;

    const baseBudget = resolvedMode === 'ACTUAL' && actualBudget ? actualBudget : budget;
    const [structureBudget, baseLines] = await Promise.all([
      baseBudget.year === 2026
        ? this.prisma.budget.findFirst({
            where: {
              year: 2025,
              kind: BudgetKind.BUDGET,
              status: BudgetStatus.READY,
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve(null),
      this.prisma.dreLine.findMany({
        where: { budgetId: baseBudget.id },
        orderBy: [{ sortOrder: 'asc' }, { month: 'asc' }],
      }),
    ]);

    const monthsSet = new Set<number>();
    const rowMap = new Map<string, any>();

    baseLines.forEach((line) => {
      if (line.month) {
        monthsSet.add(line.month);
      }
      const existing = rowMap.get(line.nodeKey);
      if (!existing) {
        rowMap.set(line.nodeKey, {
          id: line.nodeKey,
          codigo: line.accountCode,
          descricao: sanitizeLabel(line.accountName ?? ''),
          nivel: line.level,
          parentId: line.parentKey,
          valoresPorMes: {},
        });
      }
      const row = rowMap.get(line.nodeKey);
      if (line.month) {
        const monthKey = `${baseBudget.year}-${String(line.month).padStart(2, '0')}`;
        if (!row.valoresPorMes[monthKey]) {
          row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
        }
        if (line.mode === DreMode.REALIZADO) {
          row.valoresPorMes[monthKey].realizado += Number(line.value);
        } else {
          row.valoresPorMes[monthKey].previsto += Number(line.value);
        }
      }
    });

    const overlayRows = await this.prisma.budgetItem.findMany({
      where: { budgetId, isActive: true },
      include: { values: true },
    });
    const overlayByAccount = new Map<string, Map<number, number>>();
    overlayRows.forEach((item) => {
      const accountCode = item.accountCode;
      if (!accountCode) return;
      const monthMap = overlayByAccount.get(accountCode) ?? new Map<number, number>();
      item.values.forEach((value) => {
        monthMap.set(value.month, (monthMap.get(value.month) ?? 0) + Number(value.value));
      });
      overlayByAccount.set(accountCode, monthMap);
    });

    overlayByAccount.forEach((monthMap) => {
      monthMap.forEach((_value, month) => monthsSet.add(month));
    });

    const useRealizedBaseline = baseBudget.year === 2026;
    const actualByNodeKey = new Map<string, Map<number, number>>();
    const actualByAccountCode = new Map<string, Map<number, number>>();
    const actualByLabel = new Map<string, Map<number, number>>();
    if (useRealizedBaseline) {
      const realizedRows = await this.prisma.realizedValue.findMany({ where: { year: baseBudget.year } });
      realizedRows.forEach((row) => {
        const monthMap = actualByAccountCode.get(row.accountCode) ?? new Map<number, number>();
        monthMap.set(row.month, (monthMap.get(row.month) ?? 0) + Number(row.value));
        actualByAccountCode.set(row.accountCode, monthMap);
        const labelKey = normalizeDreKey(String(row.accountCode ?? ''));
        const labelMap = actualByLabel.get(labelKey) ?? new Map<number, number>();
        labelMap.set(row.month, (labelMap.get(row.month) ?? 0) + Number(row.value));
        actualByLabel.set(labelKey, labelMap);
        monthsSet.add(row.month);
      });
    } else if (actualBudget) {
      const actualLines = await this.prisma.dreLine.findMany({
        where: { budgetId: actualBudget.id, mode: DreMode.REALIZADO },
      });
      const fallbackLines = actualLines.length === 0
        ? await this.prisma.dreLine.findMany({ where: { budgetId: actualBudget.id, mode: DreMode.PREVISTO } })
        : actualLines;

      fallbackLines.forEach((line) => {
        if (!line.month) return;
        const value = Number(line.value);
        const nodeMap = actualByNodeKey.get(line.nodeKey) ?? new Map<number, number>();
        nodeMap.set(line.month, (nodeMap.get(line.month) ?? 0) + value);
        actualByNodeKey.set(line.nodeKey, nodeMap);
        if (line.accountCode) {
          const codeMap = actualByAccountCode.get(line.accountCode) ?? new Map<number, number>();
          codeMap.set(line.month, (codeMap.get(line.month) ?? 0) + value);
          actualByAccountCode.set(line.accountCode, codeMap);
        }
        const labelKey = normalizeDreKey(String(line.accountName ?? ''));
        if (labelKey) {
          const labelMap = actualByLabel.get(labelKey) ?? new Map<number, number>();
          labelMap.set(line.month, (labelMap.get(line.month) ?? 0) + value);
          actualByLabel.set(labelKey, labelMap);
        }
        monthsSet.add(line.month);
      });
    }

    const shouldUseBaseline = baseBudget.year === 2026 && (resolvedMode === 'BUDGET' || resolvedMode === 'DRE');
    let baselineByAccount: Map<string, Map<number, number>> | null = null;
    if (shouldUseBaseline) {
      const baselineRows = await this.prisma.dreBudgetBaseline.findMany({ where: { year: baseBudget.year } });
      const map = new Map<string, Map<number, number>>();
      baselineRows.forEach((row) => {
        const monthMap = map.get(row.accountCode) ?? new Map<number, number>();
        monthMap.set(row.month, Number(row.value));
        map.set(row.accountCode, monthMap);
      });
      baselineByAccount = map;
      for (let month = 1; month <= 12; month += 1) {
        monthsSet.add(month);
      }
    }

    const months = Array.from(monthsSet)
      .sort((a, b) => a - b)
      .map((month) => `${baseBudget.year}-${String(month).padStart(2, '0')}`);

    overlayByAccount.forEach((monthMap, accountCode) => {
      const row = Array.from(rowMap.values()).find((item) => item.codigo === accountCode);
      if (!row) return;
      monthMap.forEach((value, month) => {
        const monthKey = `${baseBudget.year}-${String(month).padStart(2, '0')}`;
        if (!row.valoresPorMes[monthKey]) {
          row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
        }
        row.valoresPorMes[monthKey].previsto = value;
      });
    });

    if (baselineByAccount) {
      rowMap.forEach((row) => {
        const key = row.codigo ? String(row.codigo) : normalizeDreKey(String(row.descricao ?? ''));
        const monthMap = baselineByAccount?.get(key);
        if (!monthMap) return;
        monthMap.forEach((value, month) => {
          const monthKey = `${baseBudget.year}-${String(month).padStart(2, '0')}`;
          if (!row.valoresPorMes[monthKey]) {
            row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
          }
          row.valoresPorMes[monthKey].previsto = value;
        });
      });
    }

    const shouldOverlayActual = resolvedMode === 'ACTUAL' || resolvedMode === 'PROJECTED' || resolvedMode === 'DRE';
    if (shouldOverlayActual) {
      rowMap.forEach((row) => {
        const monthMap =
          actualByNodeKey.get(String(row.id)) ??
          (row.codigo ? actualByAccountCode.get(String(row.codigo)) : undefined) ??
          actualByLabel.get(normalizeDreKey(String(row.descricao ?? '')));
        if (!monthMap) return;
        monthMap.forEach((actualValue, month) => {
          const monthKey = `${baseBudget.year}-${String(month).padStart(2, '0')}`;
          if (!row.valoresPorMes[monthKey]) {
            row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
          }
          row.valoresPorMes[monthKey].realizado = actualValue;
        });
      });
    }

    if (baseBudget.year === 2026 && structureBudget) {
      const structureLines = await this.prisma.dreLine.findMany({
        where: { budgetId: structureBudget.id },
        orderBy: [{ sortOrder: 'asc' }, { month: 'asc' }],
      });
      if (structureLines.length > 0) {
        const sourceRows = Array.from(rowMap.values());
        const sourceByCode = new Map<string, any>();
        const sourceByLabel = new Map<string, any>();
        sourceRows.forEach((row) => {
          if (row.codigo) {
            sourceByCode.set(String(row.codigo), row);
          }
          sourceByLabel.set(normalizeDreKey(String(row.descricao ?? '')), row);
        });

        const cloneValores = (
          valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }> | undefined,
        ) => {
          if (!valoresPorMes) return {};
          return Object.fromEntries(
            Object.entries(valoresPorMes).map(([monthKey, value]) => [
              monthKey,
              {
                previsto: value?.previsto ?? 0,
                realizado: value?.realizado ?? 0,
                projetado: value?.projetado ?? 0,
              },
            ]),
          );
        };

        const structuredMap = new Map<string, any>();
        structureLines.forEach((line) => {
          if (structuredMap.has(line.nodeKey)) return;
          const source =
            (line.accountCode ? sourceByCode.get(String(line.accountCode)) : null) ??
            sourceByLabel.get(normalizeDreKey(String(line.accountName ?? '')));
          structuredMap.set(line.nodeKey, {
            id: line.nodeKey,
            codigo: line.accountCode,
            descricao: sanitizeLabel(line.accountName ?? ''),
            nivel: line.level,
            parentId: line.parentKey,
            sortOrder: line.sortOrder ?? 0,
            valoresPorMes: cloneValores(source?.valoresPorMes),
          });
        });

        if (structuredMap.size > 0) {
          rowMap.clear();
          structuredMap.forEach((value, key) => rowMap.set(key, value));
        }
      }
    }

    let rows = Array.from(rowMap.values());
    let preserve2026SheetValues = false;
    if (baseBudget.year === 2026 || baseBudget.year === 2025 || baseBudget.year === 2024) {
      const sheet = getDre2026SheetData(this.logger);
      if (sheet) {
        const templateCodeBuckets = new Map<string, any[]>();
        const templateLabelBuckets = new Map<string, any[]>();
        rows.forEach((row) => {
          const code = row.codigo ? String(row.codigo).trim() : '';
          const labelKey = normalizeDreKey(String(row.descricao ?? ''));
          if (code) {
            const list = templateCodeBuckets.get(code) ?? [];
            list.push(row);
            templateCodeBuckets.set(code, list);
          }
          const labelList = templateLabelBuckets.get(labelKey) ?? [];
          labelList.push(row);
          templateLabelBuckets.set(labelKey, labelList);
        });

        const sheetRows = this.applySheetHierarchy(
          sheet.entries
          .sort((a, b) => a.rank - b.rank)
          .map((entry) => {
            const templateByCode = entry.code ? templateCodeBuckets.get(entry.code) : undefined;
            const templateByLabel = templateLabelBuckets.get(entry.labelKey);
            const template = (templateByCode && templateByCode.length > 0 ? templateByCode.shift() : undefined)
              ?? (templateByLabel && templateByLabel.length > 0 ? templateByLabel.shift() : undefined)
              ?? null;

            const rawIdBase = String(template?.id ?? `${entry.code ?? entry.labelKey}-${entry.rank}`);
            const idBase = sanitizeLabel(rawIdBase).replace(/\s+/g, '-');
            const row = {
              id: `${idBase}`,
              codigo: entry.code ?? template?.codigo ?? undefined,
              descricao: sanitizeLabel(template?.descricao ?? entry.label),
              nivel: 0,
              parentId: null,
              sortOrder: entry.rank,
              valoresPorMes: {},
            } as any;

            months.forEach((monthKey) => {
              const month = Number(monthKey.split('-')[1] ?? 0);
              if (baseBudget.year === 2026) {
                const monthValues = entry.months.get(month) ?? { previsto: 0, realizado: 0 };
                row.valoresPorMes[monthKey] = {
                  previsto: monthValues.previsto ?? 0,
                  realizado: monthValues.realizado ?? 0,
                  projetado: 0,
                };
                return;
              }

              const sourceValues = template?.valoresPorMes?.[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
              row.valoresPorMes[monthKey] = {
                previsto: sourceValues.previsto ?? 0,
                realizado: sourceValues.realizado ?? 0,
                projetado: 0,
              };
            });
            return row;
          }),
        );

        if (sheetRows.length > 0) {
          rows = sheetRows;
          this.logger.log(`DRE ${baseBudget.year} rows aligned to 2026 sheet structure: ${rows.length}`);
          preserve2026SheetValues = baseBudget.year === 2026;
        }
      }
    }

    if (baseBudget.year === 2026 && !preserve2026SheetValues) {
      rows = await this.mergeImportedBudget2026Rows(rows, months, baseBudget.year);
    }
    if (baseBudget.year === 2026 && preserve2026SheetValues) {
      const sheetRowIds = new Set(rows.map((r) => r.id));
      const savedValues = new Map(rows.map((r) => [r.id, JSON.parse(JSON.stringify(r.valoresPorMes))]));
      rows = await this.mergeImportedBudget2026Rows(rows, months, baseBudget.year);
      const idxById = new Map(rows.map((r, i) => [r.id, i]));
      sheetRowIds.forEach((id) => {
        const idx = idxById.get(id);
        if (idx !== undefined) rows[idx].valoresPorMes = savedValues.get(id)!;
      });
    }
    const shouldOverlayPlanning =
      resolvedMode === 'BUDGET' || resolvedMode === 'DRE' || resolvedMode === 'PROJECTED';
    if (shouldOverlayPlanning && !preserve2026SheetValues) {
      rows = await this.overlayPlanningForecastByYear(rows, months, baseBudget.year);
    }
    if (shouldOverlayPlanning && preserve2026SheetValues) {
      rows = await this.overlayPlanningDetailOnly(rows, months, baseBudget.year);
    }
    rows = this.applyDreStructuralCorrections(rows);

    rows.forEach((row) => {
      months.forEach((monthKey) => {
        if (!row.valoresPorMes[monthKey]) {
          row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
        }
        const monthNumber = Number(monthKey.split('-')[1] ?? 0);
        const previsto = row.valoresPorMes[monthKey].previsto ?? 0;
        const realizado = row.valoresPorMes[monthKey].realizado ?? 0;
        const projetado = computeProjectedValue(monthNumber, previsto, realizado, closingMonth);
        row.valoresPorMes[monthKey].projetado = projetado;
      });
    });

    const hierarchyCheck = inspectDreHierarchy(rows);
    if (hierarchyCheck.invalid) {
      this.logger.warn(
        `DRE hierarchy invalid for year=${baseBudget.year} roots=${hierarchyCheck.roots}/${hierarchyCheck.total} missingParents=${hierarchyCheck.missingParents} levelZeroPct=${hierarchyCheck.levelZeroPct.toFixed(2)}`,
      );
      const preview = rows.slice(0, 20).map((row) => ({
        id: row.id,
        nivel: row.nivel ?? null,
        parentId: row.parentId ?? null,
        descricao: row.descricao ?? null,
      }));
      this.logger.warn(`DRE hierarchy sample year=${baseBudget.year} ${JSON.stringify(preview)}`);
      rows = normalizeDreHierarchy(rows);
    } else {
      rows = normalizeDreHierarchy(rows);
    }
    if (!preserve2026SheetValues) {
      rows = this.rollupHierarchyMonthValues(rows, months);
    }
    this.logAmbiguousDescriptions(rows as Array<{ id: string; descricao: string; parentId?: string | null; codigo?: string | null }>, baseBudget.year);

    let grandTotals;
    if (resolvedMode === 'DRE') {
      const baseRows = rows.filter((row) => row.parentId === null);
      const totalsByMonth: Record<string, { previsto: number; realizado: number; projetado: number }> = {};
      months.forEach((monthKey) => {
        totalsByMonth[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
      });
      baseRows.forEach((row) => {
        months.forEach((monthKey) => {
          const values = row.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
          totalsByMonth[monthKey].previsto += values.previsto ?? 0;
          totalsByMonth[monthKey].realizado += values.realizado ?? 0;
          totalsByMonth[monthKey].projetado += values.projetado ?? 0;
        });
      });
      const total = (field: 'previsto' | 'realizado' | 'projetado') =>
        months.reduce((sum, monthKey) => sum + (totalsByMonth[monthKey]?.[field] ?? 0), 0);
      grandTotals = {
        previstoByMonth: months.reduce((acc, monthKey) => ({ ...acc, [monthKey]: totalsByMonth[monthKey].previsto }), {}),
        realizadoByMonth: months.reduce((acc, monthKey) => ({ ...acc, [monthKey]: totalsByMonth[monthKey].realizado }), {}),
        projetadoByMonth: months.reduce((acc, monthKey) => ({ ...acc, [monthKey]: totalsByMonth[monthKey].projetado }), {}),
        previstoTotal: total('previsto'),
        realizadoTotal: total('realizado'),
        projetadoTotal: total('projetado'),
      };
    }

    const result = {
      budgetId,
      year: baseBudget.year,
      months,
      rows,
      closingMonth,
      mode: resolvedMode,
      grandTotals,
    };
    setTreeCached(cacheKey, result);
    return result;
  }

  async auditAgainstExpandedSheet(year = 2026, budgetId?: string) {
    if (year !== 2026) {
      throw new NotFoundException({ code: 'DRE_AUDIT_YEAR_UNSUPPORTED', message: 'Somente 2026 suportado para auditoria da planilha expandida.' });
    }
    invalidateDre2026SheetCache();
    const budget = await this.resolveBudgetForSheetAudit(year, budgetId);
    const expectedRows = this.buildExpandedSheetHierarchyRows(year);
    const expectedById = new Map(expectedRows.map((row) => [row.id, row]));
    const actualById = await this.collectDashboardPrevistoNodes(budget.id);
    const { matchedByExpectedId, usedActualIds } = this.matchExpectedRowsToActual(expectedRows, actualById);

    const normalize = (value: string | null | undefined) => normalizeDreKey(String(value ?? ''));
    const issues: Array<{
      id: string;
      type:
        | 'MISSING_NODE'
        | 'EXTRA_NODE'
        | 'LABEL_MISMATCH'
        | 'CODE_MISMATCH'
        | 'PARENT_MISMATCH'
        | 'LEVEL_MISMATCH'
        | 'SORT_MISMATCH'
        | 'MONTH_VALUE_MISMATCH'
        | 'ROLLUP_MISMATCH';
      severity: 'high' | 'medium';
      nodeId?: string;
      codigo?: string | null;
      descricao?: string;
      month?: number;
      expected?: number | string | null;
      actual?: number | string | null;
      delta?: number;
      message: string;
    }> = [];

    expectedRows.forEach((expected) => {
      const actual = matchedByExpectedId.get(expected.id) ?? null;
      if (!actual) {
        issues.push({
          id: `missing:${expected.id}`,
          type: 'MISSING_NODE',
          severity: 'high',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          message: `Conta esperada ausente no DRE: ${expected.descricao}`,
        });
        return;
      }

      const expectedCode = String(expected.codigo ?? '').trim();
      const actualCode = String(actual.codigo ?? '').trim();
      if (expectedCode !== actualCode) {
        issues.push({
          id: `code:${expected.id}`,
          type: 'CODE_MISMATCH',
          severity: 'medium',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          expected: expectedCode || null,
          actual: actualCode || null,
          message: `Codigo divergente em ${expected.descricao}.`,
        });
      }

      if (normalize(expected.descricao) !== normalize(actual.descricao)) {
        issues.push({
          id: `label:${expected.id}`,
          type: 'LABEL_MISMATCH',
          severity: 'medium',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          expected: expected.descricao,
          actual: actual.descricao,
          message: `Nome divergente em ${expected.descricao}.`,
        });
      }

      const expectedParentActualId = expected.parentId
        ? matchedByExpectedId.get(expected.parentId)?.id ?? null
        : null;
      if ((expectedParentActualId ?? null) !== (actual.parentId ?? null)) {
        issues.push({
          id: `parent:${expected.id}`,
          type: 'PARENT_MISMATCH',
          severity: 'high',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          expected: expectedParentActualId ?? null,
          actual: actual.parentId ?? null,
          message: `Pai divergente em ${expected.descricao}.`,
        });
      }

      if (Number(expected.nivel ?? 0) !== Number(actual.nivel ?? 0)) {
        issues.push({
          id: `level:${expected.id}`,
          type: 'LEVEL_MISMATCH',
          severity: 'medium',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          expected: Number(expected.nivel ?? 0),
          actual: Number(actual.nivel ?? 0),
          message: `Nivel divergente em ${expected.descricao}.`,
        });
      }

      if (Number(expected.sortOrder ?? 0) !== Number(actual.sortOrder ?? 0)) {
        issues.push({
          id: `sort:${expected.id}`,
          type: 'SORT_MISMATCH',
          severity: 'medium',
          nodeId: expected.id,
          codigo: expected.codigo ?? null,
          descricao: expected.descricao,
          expected: Number(expected.sortOrder ?? 0),
          actual: Number(actual.sortOrder ?? 0),
          message: `Ordem divergente em ${expected.descricao}.`,
        });
      }

      for (let month = 1; month <= 12; month += 1) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const expectedValue = Number(expected.valoresPorMes?.[monthKey]?.previsto ?? 0);
        const actualValue = Number(actual.values[month] ?? 0);
        const delta = actualValue - expectedValue;
        if (Math.abs(delta) > 0.02) {
          issues.push({
            id: `month:${expected.id}:${month}`,
            type: 'MONTH_VALUE_MISMATCH',
            severity: 'high',
            nodeId: expected.id,
            codigo: expected.codigo ?? null,
            descricao: expected.descricao,
            month,
            expected: expectedValue,
            actual: actualValue,
            delta,
            message: `Valor divergente em ${expected.descricao} (${String(month).padStart(2, '0')}/${year}).`,
          });
        }
      }
    });

    actualById.forEach((actual) => {
      if (usedActualIds.has(actual.id)) return;
      const total = Object.values(actual.values).reduce((sum, value) => sum + Number(value ?? 0), 0);
      if (Math.abs(total) <= 0.02) return;
      issues.push({
        id: `extra:${actual.id}`,
        type: 'EXTRA_NODE',
        severity: 'medium',
        nodeId: actual.id,
        codigo: actual.codigo ?? null,
        descricao: actual.descricao,
        message: `Conta extra no DRE: ${actual.descricao}.`,
      });
    });

    const childrenByParent = new Map<string, typeof expectedRows>();
    expectedRows.forEach((row) => {
      if (!row.parentId) return;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    });
    childrenByParent.forEach((children, parentId) => {
      const parent = matchedByExpectedId.get(parentId) ?? null;
      if (!parent) return;
      for (let month = 1; month <= 12; month += 1) {
        const parentValue = Number(parent.values[month] ?? 0);
        const sumChildren = children.reduce((sum, child) => {
          const childNode = matchedByExpectedId.get(child.id) ?? null;
          return sum + Number(childNode?.values[month] ?? 0);
        }, 0);
        const delta = parentValue - sumChildren;
        if (Math.abs(delta) > 0.02) {
          const parentExpected = expectedById.get(parentId);
          issues.push({
            id: `rollup:${parentId}:${month}`,
            type: 'ROLLUP_MISMATCH',
            severity: 'high',
            nodeId: parentId,
            codigo: parentExpected?.codigo ?? null,
            descricao: parentExpected?.descricao ?? parent.descricao,
            month,
            expected: sumChildren,
            actual: parentValue,
            delta,
            message: `Rollup divergente em ${(parentExpected?.descricao ?? parent.descricao)} (${String(month).padStart(2, '0')}/${year}).`,
          });
        }
      }
    });

    const byType = issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.type] = (acc[issue.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      year,
      budgetId: budget.id,
      budgetName: budget.name,
      source: 'dre expandida',
      generatedAt: new Date().toISOString(),
      summary: {
        totalIssues: issues.length,
        high: issues.filter((issue) => issue.severity === 'high').length,
        medium: issues.filter((issue) => issue.severity === 'medium').length,
        byType,
      },
      issues: issues.slice(0, 2000),
    };
  }

  async autoFixFromExpandedSheet(year = 2026, budgetId?: string) {
    if (year !== 2026) {
      throw new NotFoundException({ code: 'DRE_AUDIT_YEAR_UNSUPPORTED', message: 'Somente 2026 suportado para ajuste automatico da planilha expandida.' });
    }
    invalidateDre2026SheetCache();
    const budget = await this.resolveBudgetForSheetAudit(year, budgetId);
    const expectedRows = this.buildExpandedSheetHierarchyRows(year);
    const actualById = await this.collectBudgetPrevistoNodes(budget.id);
    const { matchedByExpectedId } = this.matchExpectedRowsToActual(expectedRows, actualById);
    const nodeKeyByExpected = new Map<string, string>();
    expectedRows.forEach((row) => {
      nodeKeyByExpected.set(row.id, matchedByExpectedId.get(row.id)?.id ?? row.id);
    });

    const data = expectedRows.flatMap((row) =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const value = Number(row.valoresPorMes?.[monthKey]?.previsto ?? 0);
        const nodeKey = nodeKeyByExpected.get(row.id) ?? row.id;
        const parentKey = row.parentId ? nodeKeyByExpected.get(row.parentId) ?? row.parentId : null;
        return {
          budgetId: budget.id,
          nodeKey,
          parentKey,
          level: Number(row.nivel ?? 0),
          sortOrder: Number(row.sortOrder ?? 0),
          accountCode: row.codigo ?? null,
          accountName: row.descricao,
          groupPath: parentKey ? `${parentKey}>${nodeKey}` : nodeKey,
          month,
          mode: DreMode.PREVISTO,
          value,
        };
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.dreLine.deleteMany({
        where: { budgetId: budget.id, mode: DreMode.PREVISTO },
      });
      if (data.length > 0) {
        await tx.dreLine.createMany({ data });
      }
    });

    const audit = await this.auditAgainstExpandedSheet(year, budget.id);
    return {
      year,
      budgetId: budget.id,
      updatedRows: expectedRows.length,
      updatedCells: data.length,
      audit,
    };
  }

  private async resolveComparisonBudgets(year: number) {
    const currentBudget = await this.prisma.budget.findFirst({
      where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
      orderBy: { updatedAt: 'desc' },
    });
    if (!currentBudget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: `Budget ${year} not found` });
    }

    let previousBudget = await this.prisma.budget.findFirst({
      where: { year: year - 1, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
      orderBy: { updatedAt: 'desc' },
    });
    if (!previousBudget) {
      previousBudget = await this.prisma.budget.findFirst({
        where: { year: { lt: year }, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
        orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
      });
    }

    return { currentBudget, previousBudget };
  }

  private async resolveBudgetForSheetAudit(year: number, budgetId?: string) {
    if (budgetId) {
      const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
      if (!budget) {
        throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found' });
      }
      if (budget.year !== year || budget.kind !== BudgetKind.BUDGET) {
        throw new NotFoundException({ code: 'BUDGET_INVALID_FOR_AUDIT', message: `Budget informado nao pertence ao DRE ${year}.` });
      }
      return budget;
    }
    const budget = await this.prisma.budget.findFirst({
      where: { year, kind: BudgetKind.BUDGET, status: BudgetStatus.READY },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: `Budget ${year} not found` });
    }
    return budget;
  }

  private buildExpandedSheetHierarchyRows(year: number) {
    const sheet = getDre2026SheetData(this.logger);
    if (!sheet || sheet.entries.length === 0) {
      throw new NotFoundException({ code: 'DRE_SHEET_NOT_FOUND', message: 'Planilha dre expandida nao encontrada.' });
    }

    const rows: DreSheetHierarchyRow[] = this.applySheetHierarchy(
      sheet.entries
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
          const keySource = normalizeDreKey(entry.code ?? entry.labelKey).replace(/[^A-Z0-9]+/g, '-');
          const safeKey = keySource || `ROW-${entry.rank}`;
          const id = `DRE26-SHEET-${String(entry.rank).padStart(3, '0')}-${safeKey}`;
          const valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }> = {};
          for (let month = 1; month <= 12; month += 1) {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthValues = entry.months.get(month) ?? { previsto: 0, realizado: 0 };
            valoresPorMes[monthKey] = {
              previsto: Number(monthValues.previsto ?? 0),
              realizado: Number(monthValues.realizado ?? 0),
              projetado: 0,
            };
          }
          return {
            id,
            codigo: entry.code ?? null,
            descricao: sanitizeLabel(entry.label),
            nivel: 0,
            parentId: null,
            sortOrder: Number(entry.rank ?? 0),
            valoresPorMes,
          };
        }),
    );

    return rows;
  }

  private async collectBudgetPrevistoNodes(budgetId: string) {
    const lines = await this.prisma.dreLine.findMany({
      where: { budgetId, mode: DreMode.PREVISTO },
      orderBy: [{ sortOrder: 'asc' }, { month: 'asc' }],
    });
    const actualById = new Map<string, DreNodeAudit>();
    lines.forEach((line) => {
      const node = actualById.get(line.nodeKey) ?? {
        id: line.nodeKey,
        codigo: line.accountCode ?? null,
        descricao: sanitizeLabel(line.accountName ?? ''),
        nivel: Number(line.level ?? 0),
        parentId: line.parentKey ?? null,
        sortOrder: Number(line.sortOrder ?? 0),
        values: {},
      };
      if (line.month) {
        node.values[line.month] = Number(node.values[line.month] ?? 0) + Number(line.value ?? 0);
      }
      actualById.set(line.nodeKey, node);
    });
    return actualById;
  }

  private async collectDashboardPrevistoNodes(budgetId: string) {
    const tree = await this.getTree(budgetId, 'DRE');
    const rows = Array.isArray(tree?.rows) ? tree.rows : [];
    const actualById = new Map<string, DreNodeAudit>();

    rows.forEach((row: any, index: number) => {
      const values: Record<number, number> = {};
      Object.entries(row?.valoresPorMes ?? {}).forEach(([monthKey, monthValues]) => {
        const monthMatch = String(monthKey).match(/-(\d{2})$/);
        if (!monthMatch) return;
        const month = Number(monthMatch[1]);
        const previsto = Number((monthValues as any)?.previsto ?? 0);
        values[month] = previsto;
      });

      const id = String(row?.id ?? `ROW-${index}`);
      actualById.set(id, {
        id,
        codigo: row?.codigo ? String(row.codigo) : null,
        descricao: sanitizeLabel(String(row?.descricao ?? '')),
        nivel: Number(row?.nivel ?? 0),
        parentId: row?.parentId ? String(row.parentId) : null,
        sortOrder: Number(row?.sortOrder ?? index),
        values,
      });
    });

    return actualById;
  }

  private matchExpectedRowsToActual(expectedRows: DreSheetHierarchyRow[], actualById: Map<string, DreNodeAudit>) {
    const byCode = new Map<string, DreNodeAudit[]>();
    const byLabel = new Map<string, DreNodeAudit[]>();
    actualById.forEach((row) => {
      const code = String(row.codigo ?? '').trim();
      const label = normalizeDreKey(String(row.descricao ?? ''));
      if (code) {
        const list = byCode.get(code) ?? [];
        list.push(row);
        byCode.set(code, list);
      }
      const labelList = byLabel.get(label) ?? [];
      labelList.push(row);
      byLabel.set(label, labelList);
    });
    byCode.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));
    byLabel.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));

    const popBy = (bucket: Map<string, DreNodeAudit[]>, key: string) => {
      const list = bucket.get(key);
      if (!list || list.length === 0) return null;
      const found = list.shift() ?? null;
      if (list.length === 0) bucket.delete(key);
      return found;
    };

    const matchedByExpectedId = new Map<string, DreNodeAudit>();
    const usedActualIds = new Set<string>();

    expectedRows.forEach((expected) => {
      const codeKey = String(expected.codigo ?? '').trim();
      const labelKey = normalizeDreKey(String(expected.descricao ?? ''));
      let found = codeKey ? popBy(byCode, codeKey) : null;
      if (!found) {
        found = popBy(byLabel, labelKey);
      }
      if (!found) return;
      matchedByExpectedId.set(expected.id, found);
      usedActualIds.add(found.id);
    });

    return { matchedByExpectedId, usedActualIds };
  }

  private clampMonth(value: number) {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(12, Math.floor(value)));
  }

  private resolveLastClosedMonth(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(12, Math.floor(value)));
  }

  private simplifyMarkerLabel(value: string) {
    return normalizeDreKey(String(value ?? '').replace(/^\s*\(([+\-=])\)\s*/u, ''));
  }

  private indexRowsByCodeOrLabel(rows: DreTreeRow[]) {
    const byCode = new Map<string, DreTreeRow[]>();
    const byLabel = new Map<string, DreTreeRow[]>();
    rows.forEach((row) => {
      const labelKey = normalizeDreKey(String(row.descricao ?? ''));
      const labelList = byLabel.get(labelKey) ?? [];
      labelList.push(row);
      byLabel.set(labelKey, labelList);
      const simplified = this.simplifyMarkerLabel(String(row.descricao ?? ''));
      if (simplified && simplified !== labelKey) {
        const simplifiedList = byLabel.get(simplified) ?? [];
        simplifiedList.push(row);
        byLabel.set(simplified, simplifiedList);
      }
      if (row.codigo) {
        const code = String(row.codigo).trim();
        const codeList = byCode.get(code) ?? [];
        codeList.push(row);
        byCode.set(code, codeList);
      }
    });
    return { byCode, byLabel };
  }

  private logAmbiguousDescriptions(
    rows: Array<{ id: string; descricao: string; parentId?: string | null; codigo?: string | null }>,
    year: number,
  ) {
    const normalize = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

    const byId = new Map(rows.map((row) => [row.id, row]));
    const buckets = new Map<string, Array<{ id: string; descricao: string; parentLabel: string | null; codigo: string | null }>>();
    rows.forEach((row) => {
      const key = normalize(row.descricao);
      if (!key) return;
      const parent = row.parentId ? byId.get(row.parentId) : null;
      const list = buckets.get(key) ?? [];
      list.push({
        id: row.id,
        descricao: row.descricao,
        parentLabel: parent ? parent.descricao : null,
        codigo: row.codigo ?? null,
      });
      buckets.set(key, list);
    });

    const ambiguous = [...buckets.values()].filter((items) => {
      if (items.length <= 1) return false;
      const parents = new Set(items.map((item) => item.parentLabel ?? '<ROOT>'));
      return parents.size > 1;
    });

    if (ambiguous.length === 0) return;
    const sample = ambiguous.slice(0, 10).map((items) => ({
      descricao: items[0]?.descricao ?? '',
      variants: items.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        parent: item.parentLabel ?? '<ROOT>',
      })),
    }));
    this.logger.warn(
      `DRE quality alert year=${year}: duplicated descriptions under different parents detected (${ambiguous.length}). sample=${JSON.stringify(sample)}`,
    );
  }

  private applySheetHierarchy<
    T extends { id: string; descricao: string; parentId?: string | null; nivel?: number | null; sortOrder?: number | null },
  >(rows: T[]) {
    if (rows.length === 0) return rows;
    const markerRegex = /^\s*\(([+\-=])\)\s*(.+)$/u;
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    let currentGroupId: string | null = null;
    let deducoesRootId: string | null = null;
    let inDeducoesBlock = false;
    let receitaLiquidaRootId: string | null = null;
    let inReceitaLiquidaBlock = false;

    return rows
      .slice()
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
      .map((row) => {
        const marker = String(row.descricao ?? '').match(markerRegex);
        if (marker) {
          const sign = marker[1];
          const markerLabel = normalize(marker[2] ?? '');
          const isDeducoesRoot = sign === '-' && markerLabel.includes('DEDUCOES');
          const isDeducoesChild = inDeducoesBlock && sign === '-' && !markerLabel.includes('DEDUCOES');

          if (isDeducoesRoot) {
            inDeducoesBlock = true;
            inReceitaLiquidaBlock = false;
            receitaLiquidaRootId = null;
            deducoesRootId = row.id;
            currentGroupId = row.id;
            return { ...row, nivel: 0, parentId: null };
          }

          if (isDeducoesChild && deducoesRootId) {
            currentGroupId = row.id;
            return { ...row, nivel: 1, parentId: deducoesRootId };
          }

          const isReceitaLiquidaExact =
            sign === '=' &&
            markerLabel.includes('RECEITA LIQUIDA') &&
            !markerLabel.includes('RECEITA LIQUIDA SOBRE');
          const isReceitaLiquidaChild =
            inReceitaLiquidaBlock &&
            sign === '=' &&
            markerLabel.includes('RECEITA LIQUIDA SOBRE');

          if (isReceitaLiquidaExact) {
            inDeducoesBlock = false;
            deducoesRootId = null;
            inReceitaLiquidaBlock = true;
            receitaLiquidaRootId = row.id;
            currentGroupId = row.id;
            return { ...row, nivel: 0, parentId: null };
          }

          if (isReceitaLiquidaChild && receitaLiquidaRootId) {
            currentGroupId = row.id;
            return { ...row, nivel: 1, parentId: receitaLiquidaRootId };
          }

          inDeducoesBlock = false;
          deducoesRootId = null;
          inReceitaLiquidaBlock = false;
          receitaLiquidaRootId = null;
          currentGroupId = row.id;
          return { ...row, nivel: 0, parentId: null };
        }

        if (inDeducoesBlock && deducoesRootId && currentGroupId && currentGroupId !== deducoesRootId) {
          return { ...row, nivel: 2, parentId: currentGroupId };
        }
        if (inReceitaLiquidaBlock && receitaLiquidaRootId && currentGroupId && currentGroupId !== receitaLiquidaRootId) {
          return { ...row, nivel: 2, parentId: currentGroupId };
        }
        if (currentGroupId) {
          return { ...row, nivel: 1, parentId: currentGroupId };
        }
        return { ...row, nivel: 0, parentId: null };
      });
  }

  private findComparableRow(
    indexed: { byCode: Map<string, DreTreeRow[]>; byLabel: Map<string, DreTreeRow[]> },
    row: DreTreeRow,
  ) {
    const byCode = row.codigo ? indexed.byCode.get(String(row.codigo).trim()) : undefined;
    if (byCode && byCode.length > 0) {
      return byCode[0];
    }
    const byLabel = indexed.byLabel.get(normalizeDreKey(String(row.descricao ?? '')));
    if (byLabel && byLabel.length > 0) {
      return byLabel[0];
    }
    const simplifiedLabel = indexed.byLabel.get(this.simplifyMarkerLabel(String(row.descricao ?? '')));
    if (simplifiedLabel && simplifiedLabel.length > 0) {
      return simplifiedLabel[0];
    }
    return undefined;
  }

  private toMonthSeries(row: DreTreeRow | undefined, year: number) {
    const previsto: number[] = [];
    const realizado: number[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const values = row?.valoresPorMes?.[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      previsto.push(values.previsto ?? 0);
      realizado.push(values.realizado ?? 0);
    }
    return { previsto, realizado };
  }

  private rollupExerciseRows<T extends { id: string; parentId?: string | null; currentValue: number; previousValue: number; deltaValue: number; deltaPct: number | null }>(rows: T[]) {
    if (rows.length === 0) return rows;

    const byId = new Map(rows.map((row) => [row.id, row]));
    const childrenByParent = new Map<string, T[]>();
    rows.forEach((row) => {
      if (!row.parentId) return;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    });

    const visited = new Set<string>();
    const walk = (row: T): { current: number; previous: number } => {
      if (visited.has(row.id)) {
        return { current: row.currentValue, previous: row.previousValue };
      }

      const children = childrenByParent.get(row.id) ?? [];
      let childrenCurrent = 0;
      let childrenPrevious = 0;
      children.forEach((child) => {
        const rolled = walk(child);
        childrenCurrent += rolled.current;
        childrenPrevious += rolled.previous;
      });

      if (children.length > 0) {
        // Keep explicit value when present; otherwise inherit children totals.
        const hasOwnCurrent = Math.abs(row.currentValue) > 0.000001;
        const hasOwnPrevious = Math.abs(row.previousValue) > 0.000001;
        if (!hasOwnCurrent) row.currentValue = childrenCurrent;
        if (!hasOwnPrevious) row.previousValue = childrenPrevious;
        const delta = computeDeltaMetrics(row.currentValue, row.previousValue);
        row.deltaValue = delta.deltaValue;
        row.deltaPct = delta.deltaPct;
      }

      visited.add(row.id);
      return { current: row.currentValue, previous: row.previousValue };
    };

    rows.forEach((row) => {
      if (!row.parentId || !byId.has(row.parentId)) {
        walk(row);
      }
    });

    return rows;
  }

  private ensureExerciseHierarchy<T extends { id: string; descricao: string; nivel: number; parentId?: string | null }>(rows: T[]) {
    if (rows.length === 0) return rows;

    const idSet = new Set(rows.map((row) => String(row.id)));
    const hasExplicitParent = rows.some((row) => Boolean(row.parentId));
    const missingExplicitParents = rows.filter((row) => row.parentId && !idSet.has(String(row.parentId))).length;
    if (hasExplicitParent && missingExplicitParents === 0) {
      return rows.map((row) => ({
        ...row,
        nivel: Number.isFinite(Number(row.nivel)) ? Number(row.nivel) : 0,
        parentId: row.parentId ? String(row.parentId) : null,
      })) as T[];
    }

    const markerMatch = (descricao: string) => descricao.match(/^\s*\(([+\-=])\)\s*(.*)$/);
    const normalizeLabel = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    const attachByLevel = (levels: number[]) => {
      const stack: Array<{ id: string; level: number }> = [];
      return rows.map((row, index) => {
        const rawLevel = levels[index] ?? 0;
        const level = Number.isFinite(rawLevel) && rawLevel > 0 ? rawLevel : 0;
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        const parentId = level > 0 ? stack[stack.length - 1]?.id ?? null : null;
        stack.push({ id: row.id, level });
        return { ...row, nivel: level, parentId };
      });
    };

    const explicitLevels = rows.map((row) => Number(row.nivel ?? 0));
    const firstPass = attachByLevel(explicitLevels);
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
    if (!tooFlat && !hasInvalidMarkerGrouping) return firstPass as T[];

    const deducoesIndex = rows.findIndex((row) => {
      const marker = markerMatch(String(row.descricao ?? ''));
      return marker?.[1] === '-' && normalizeLabel(marker?.[2] ?? '').includes('DEDUCOES');
    });
    const fallbackLevels: number[] = [];
    let hasRootMarker = false;
    let minusRootCreated = false;
    let minusGroupCreated = false;

    rows.forEach((row, index) => {
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

    return attachByLevel(fallbackLevels) as T[];
  }

  private async mergeImportedBudget2026Rows(
    rows: Array<{
      id: string;
      codigo?: string | null;
      descricao: string;
      nivel: number;
      parentId?: string | null;
      sortOrder?: number;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    }>,
    months: string[],
    year: number,
  ) {
    const imported = await this.prisma.importedBudget2026Entry.findMany({
      where: { year },
      orderBy: [{ accountPathId: 'asc' }, { month: 'asc' }],
    });
    if (imported.length === 0) return rows;

    const monthSet = new Set<number>(months.map((monthKey) => Number(monthKey.split('-')[1])));
    const aggregated = new Map<
      string,
      {
        accountLabel: string;
        detailLabel: string | null;
        valuesByMonth: Map<number, number>;
      }
    >();
    imported.forEach((entry) => {
      if (!monthSet.has(entry.month)) return;
      const bucket = aggregated.get(entry.accountPathId) ?? {
        accountLabel: entry.accountLabel,
        detailLabel: entry.detailLabel ?? null,
        valuesByMonth: new Map<number, number>(),
      };
      bucket.valuesByMonth.set(entry.month, (bucket.valuesByMonth.get(entry.month) ?? 0) + Number(entry.value));
      aggregated.set(entry.accountPathId, bucket);
    });

    const normalizedRowsByLabel = new Map<string, string[]>();
    rows.forEach((row) => {
      const key = normalizeDreKey(String(row.descricao ?? ''));
      const list = normalizedRowsByLabel.get(key) ?? [];
      list.push(row.id);
      normalizedRowsByLabel.set(key, list);
    });

    const rowById = new Map(rows.map((row) => [row.id, row]));
    const pathToRowId = new Map<string, string>();
    let sortCursor = rows.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), 0);

    const applyImportedValues = (rowId: string, monthValues: Map<number, number>) => {
      const row = rowById.get(rowId);
      if (!row) return;
      months.forEach((monthKey) => {
        const month = Number(monthKey.split('-')[1]);
        if (!row.valoresPorMes[monthKey]) {
          row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
        }
        row.valoresPorMes[monthKey].previsto = monthValues.get(month) ?? 0;
      });
    };

    const sortedPaths = Array.from(aggregated.keys()).sort((a, b) => {
      const aLevel = a.split('/').length;
      const bLevel = b.split('/').length;
      if (aLevel === bLevel) return a.localeCompare(b);
      return aLevel - bLevel;
    });

    sortedPaths.forEach((pathId) => {
      const node = aggregated.get(pathId)!;
      const parts = pathId.split('/');
      const level = Math.max(0, parts.length - 1);
      const parentPathId = level > 0 ? parts.slice(0, -1).join('/') : null;
      const label = level === 0 ? node.accountLabel : node.detailLabel ?? node.accountLabel;
      const labelKey = normalizeDreKey(label);

      let targetRowId = pathToRowId.get(pathId);
      if (!targetRowId) {
        const existingCandidates = normalizedRowsByLabel.get(labelKey) ?? [];
        targetRowId = existingCandidates.find((id) => {
          const row = rowById.get(id);
          if (!row) return false;
          return Number(row.nivel ?? 0) === level;
        });
      }

      if (!targetRowId) {
        sortCursor += 1;
        const syntheticId = `import-2026:${pathId}`;
        const parentId = parentPathId ? pathToRowId.get(parentPathId) ?? null : null;
        const created = {
          id: syntheticId,
          codigo: `DRE26:${pathId}`,
          descricao: label,
          nivel: level,
          parentId,
          sortOrder: sortCursor,
          valoresPorMes: {} as Record<string, { previsto: number; realizado: number; projetado: number }>,
        };
        months.forEach((monthKey) => {
          created.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
        });
        rows.push(created);
        rowById.set(syntheticId, created);
        const list = normalizedRowsByLabel.get(labelKey) ?? [];
        list.push(syntheticId);
        normalizedRowsByLabel.set(labelKey, list);
        targetRowId = syntheticId;
      } else {
        const row = rowById.get(targetRowId);
        if (row && parentPathId) {
          row.parentId = pathToRowId.get(parentPathId) ?? row.parentId ?? null;
        }
      }

      pathToRowId.set(pathId, targetRowId);
      applyImportedValues(targetRowId, node.valuesByMonth);
    });

    return rows;
  }

  private async overlayPlanningForecastByYear(
    rows: Array<{
      id: string;
      codigo?: string | null;
      descricao: string;
      nivel: number;
      parentId?: string | null;
      sortOrder?: number;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    }>,
    months: string[],
    year: number,
  ) {
    const normalizeText = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

    const toSlug = (value: string) =>
      normalizeText(value)
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'SEM-CATEGORIA';

    const scoreTarget = (
      target: { descricao: string },
      categoryHint: string,
      aggDescricao: string,
      detailLabels: string[],
    ) => {
      const targetText = normalizeText(String(target.descricao ?? ''));
      if (!targetText) return 0;
      const hintText = normalizeText(categoryHint);
      const aggText = normalizeText(aggDescricao);
      let score = 0;
      if (hintText && (targetText.includes(hintText) || hintText.includes(targetText))) score += 250;
      if (aggText && (targetText.includes(aggText) || aggText.includes(targetText))) score += 100;
      detailLabels.forEach((label) => {
        const text = normalizeText(label);
        if (text && targetText.includes(text)) score += 8;
      });
      return score;
    };

    const resolveCategoryHint = (raw: string) => {
      const value = normalizeText(raw);
      if (!value) return '';
      const aliases: Array<[string, string]> = [
        ['IMPOSTOS/TAXAS/CONTRIBUICOES', 'IMPOSTOS'],
        ['COMUNICACAO E INFORMATICA', 'SOFTWARES'],
        ['VIAGENS E COMERCIAL', 'DESPESAS COM VIAGENS'],
        ['OUTRAS DESPESAS INDIRETAS', 'OUTRAS DESPESAS'],
        ['INSTALACOES E PRESTACAO DE SERVICOS', 'PRESTACAO DE SERVICOS'],
        ['GASTOS COM PESSOAL FOLHA', 'CUSTOS COM PESSOAL'],
        ['GASTOS COM PESSOAL OUTROS', 'DESPESAS COM PESSOAL'],
        ['COPA/COZINHA/MAT.EXPEDIENTE', 'OUTRAS DESPESAS'],
        ['DEPRECIACAO, AMORTIZACAO E EXAUSTAO (ADM)', 'DEPRECIACAO'],
        ['DEPRECIACAO, AMORTIZACAO E EXAUSTAO (FABRICA)', 'DEPRECIACAO'],
        ['DESPESA COM PERDA E CREDITOS DE CLIENTES', 'OUTRAS DESPESAS DIRETAS'],
        ['PENITENCIARIA/TERCEIROS', 'PRESTACAO DE SERVICOS'],
      ];
      const match = aliases.find(([from]) => value.includes(from));
      return match?.[1] ?? raw;
    };

    const extractHintFromDetails = (labels: string[]) => {
      const counts = new Map<string, number>();
      labels.forEach((label) => {
        const normalized = String(label).trim();
        const match =
          normalized.match(/^\d+(?:\.[^\s-]+)?\s*-\s*([^-]+?)\s*-\s*.+$/) ??
          normalized.match(/^\d+(?:\.[^\s-]+)?\s*-\s*([^-]+?)\s*$/);
        const hint = match?.[1]?.trim();
        if (!hint) return;
        counts.set(hint, (counts.get(hint) ?? 0) + 1);
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const extractCoreLabel = (value: string) => {
      const raw = String(value ?? '').trim();
      const withoutCode = raw.replace(/^\d+(?:\.[^\s-]+)?\s*-\s*/u, '').trim();
      const parts = withoutCode.split(/\s+-\s+/u).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const first = normalizeText(parts[0]);
        const second = normalizeText(parts[1]);
        if (first === second || first.includes(second) || second.includes(first)) {
          return parts[0];
        }
      }
      return withoutCode;
    };

    const planningAccounts = await this.prisma.planningAccount.findMany({
      where: {
        values: { some: { year } },
      },
      select: {
        code: true,
        name: true,
        label: true,
        proacao: { select: { name: true } },
        values: {
          where: { year },
          select: { month: true, value: true },
        },
      },
    });

    if (planningAccounts.length === 0) return rows;

    const aggregatedBuckets = new Map<
      string,
      {
        baseCode: string;
        descricao: string;
        categoryHint: string;
        byMonth: Map<number, number>;
        details: Map<string, { detailId: string; descricao: string; keywords: string[]; byMonth: Map<number, number> }>;
      }
    >();
    planningAccounts.forEach((account) => {
      const rawCode = String(account.code ?? '').trim();
      if (!rawCode) return;
      const baseCode = rawCode.split('.')[0]?.trim();
      if (!baseCode || !/^\d+$/.test(baseCode)) return;
      const categoryHint = resolveCategoryHint(String(account.proacao?.name ?? '').trim());
      const categoryKey = normalizeText(categoryHint);
      const bucketKey = `${baseCode}|${categoryKey || '__SEM_HINT__'}`;
      const bucket = aggregatedBuckets.get(bucketKey) ?? {
        baseCode,
        descricao: String(categoryHint || account.name || account.label || baseCode).trim() || baseCode,
        categoryHint,
        byMonth: new Map<number, number>(),
        details: new Map<string, { detailId: string; descricao: string; keywords: string[]; byMonth: Map<number, number> }>(),
      };
      account.values.forEach((item) => {
        bucket.byMonth.set(item.month, (bucket.byMonth.get(item.month) ?? 0) + Number(item.value));
      });
      aggregatedBuckets.set(bucketKey, bucket);

      const fullCode = rawCode;
      const detailLabel = String(account.label ?? account.name ?? fullCode).trim() || fullCode;
      const detailNameParts = detailLabel
        .split('-')
        .map((part) => part.trim())
        .filter(Boolean);
      const detailKey = normalizeText(detailLabel);
      let detailBucket = bucket.details.get(detailKey);
      if (!detailBucket) {
        detailBucket = {
          detailId: `planning-${year}:${baseCode}:${toSlug(categoryHint)}:${detailKey.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'DETALHE'}`,
          descricao: detailLabel,
          keywords: detailNameParts,
          byMonth: new Map<number, number>(),
        };
        bucket.details.set(detailKey, detailBucket);
      }
      account.values.forEach((item) => {
        detailBucket!.byMonth.set(item.month, (detailBucket!.byMonth.get(item.month) ?? 0) + Number(item.value));
      });
    });

    if (aggregatedBuckets.size === 0) return rows;

    const byCode = new Map<string, Array<typeof rows[number]>>();
    rows.forEach((row) => {
      if (!row.codigo) return;
      const code = String(row.codigo).trim();
      const list = byCode.get(code) ?? [];
      list.push(row);
      byCode.set(code, list);
    });
    const childrenCount = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.parentId) return;
      childrenCount.set(row.parentId, (childrenCount.get(row.parentId) ?? 0) + 1);
    });
    const realRows = rows.filter((row) => {
      if (String(row.id).startsWith(`planning-${year}:`)) return false;
      const label = String(row.descricao ?? '').trim();
      const isMarker = /^\(?\s*\([+\-=]\)/u.test(label) || /^\s*\([+\-=]\)/u.test(label);
      const isStructural = (childrenCount.get(row.id) ?? 0) > 0 || !row.parentId;
      return isMarker || isStructural;
    });

    let sortCursor = rows.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), 0);
    const parentSeeded = new Set<string>();

    aggregatedBuckets.forEach((agg) => {
      const code = agg.baseCode;
      const details = [...agg.details.values()];
      const detailLabels = details.map((item) => item.descricao);
      const hintDescricao = extractHintFromDetails(detailLabels) ?? agg.descricao;
      const categoryHint = agg.categoryHint || hintDescricao;
      let targets = byCode.get(code) ?? [];
      if (targets.length !== 1) {
        const hintMatches = realRows
          .map((row) => ({ row, score: scoreTarget(row, categoryHint, hintDescricao, detailLabels) }))
          .filter((entry) => entry.score >= 80)
          .sort((left, right) => right.score - left.score);
        if (hintMatches.length > 0) {
          targets = [hintMatches[0].row];
        }
      }
      const bestCodeTargetScore = targets.reduce((max, row) => {
        return Math.max(max, scoreTarget(row, categoryHint, hintDescricao, detailLabels));
      }, 0);
      if (bestCodeTargetScore < 50) {
        const descriptionFallback = realRows
          .map((row) => ({ row, score: scoreTarget(row, categoryHint, hintDescricao, detailLabels) }))
          .sort((left, right) => right.score - left.score)[0];
        if (descriptionFallback && descriptionFallback.score > bestCodeTargetScore) {
          targets = [descriptionFallback.row];
        }
      }
      if (targets.length === 0) {
        sortCursor += 1;
        const row = {
          id: `planning-2026:${code}`,
          codigo: code,
          descricao: agg.descricao,
          nivel: 0,
          parentId: null,
          sortOrder: sortCursor,
          valoresPorMes: {},
        };
        rows.push(row);
        targets = [row];
        byCode.set(code, targets);
      }
      const selectedTarget =
        targets.length <= 1
          ? targets[0]
          : [...targets]
              .sort((left, right) => {
                const leftScore = scoreTarget(
                  left,
                  categoryHint,
                  hintDescricao,
                  details.map((item) => item.descricao),
                );
                const rightScore = scoreTarget(
                  right,
                  categoryHint,
                  hintDescricao,
                  details.map((item) => item.descricao),
                );
                if (leftScore !== rightScore) return rightScore - leftScore;
                return Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
              })[0];

      // Keep chosen parent row aligned with consolidated total by base account code.
      [selectedTarget].filter(Boolean).forEach((row) => {
        if (!parentSeeded.has(row.id)) {
          months.forEach((monthKey) => {
            if (!row.valoresPorMes[monthKey]) {
              row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
            }
            row.valoresPorMes[monthKey].previsto = 0;
          });
          parentSeeded.add(row.id);
        }
        months.forEach((monthKey) => {
          const month = Number(monthKey.split('-')[1] ?? 0);
          if (!row.valoresPorMes[monthKey]) {
            row.valoresPorMes[monthKey] = { previsto: 0, realizado: 0, projetado: 0 };
          }
          row.valoresPorMes[monthKey].previsto += agg.byMonth.get(month) ?? 0;
        });
      });

      // Also expose detailed coordinator lines in DRE (child rows), preserving full account codes.
      if (details.length === 0) return;
      const parent = selectedTarget;
      if (!parent) return;
      const parentLevel = Number(parent.nivel ?? 0);
      let localSort = Number(parent.sortOrder ?? 0);

      details
        .filter((detail) => normalizeText(detail.descricao) !== normalizeText(parent.descricao))
        .forEach((detail) => {
          const detailCore = normalizeText(extractCoreLabel(detail.descricao));
          const hasEquivalentChild = rows.some((row) => {
            if (String(row.id).startsWith(`planning-${year}:`)) return false;
            const rowCore = normalizeText(extractCoreLabel(row.descricao));
            const rowCode = String(row.codigo ?? '').trim();
            const rowStartsWithCode = normalizeText(row.descricao).startsWith(`${code} -`);
            const sameCode = rowCode === code || rowStartsWithCode;
            if (!sameCode) return false;
            return (
              rowCore === detailCore ||
              rowCore.includes(detailCore) ||
              detailCore.includes(rowCore)
            );
          });
          if (hasEquivalentChild) return;

          localSort += 0.001;
          const detailRowId = detail.detailId;
          if (rows.some((row) => row.id === detailRowId)) return;
          const detailRow = {
            id: detailRowId,
            codigo: code,
            descricao: detail.descricao,
            nivel: parentLevel + 1,
            parentId: parent.id,
            sortOrder: localSort,
            valoresPorMes: {} as Record<string, { previsto: number; realizado: number; projetado: number }>,
          };
          months.forEach((monthKey) => {
            const month = Number(monthKey.split('-')[1] ?? 0);
            detailRow.valoresPorMes[monthKey] = {
              previsto: detail.byMonth.get(month) ?? 0,
              realizado: 0,
              projetado: 0,
            };
          });
          rows.push(detailRow);
        });
    });

    return rows;
  }

  private async overlayPlanningDetailOnly(
    rows: Array<{
      id: string;
      codigo?: string | null;
      descricao: string;
      nivel: number;
      parentId?: string | null;
      sortOrder?: number;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    }>,
    months: string[],
    year: number,
  ) {
    const sheetRowIds = new Set(rows.map((r) => r.id));
    const savedValues = new Map(
      rows.map((r) => [r.id, JSON.parse(JSON.stringify(r.valoresPorMes)) as Record<string, { previsto: number; realizado: number; projetado: number }>]),
    );

    rows = await this.overlayPlanningForecastByYear(rows, months, year);

    const rowById = new Map(rows.map((r) => [r.id, r]));
    sheetRowIds.forEach((id) => {
      const row = rowById.get(id);
      if (row) row.valoresPorMes = savedValues.get(id)!;
    });

    const childrenByParent = new Map<string, typeof rows>();
    rows.forEach((row) => {
      if (!row.parentId || sheetRowIds.has(row.id)) return;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    });

    childrenByParent.forEach((children, parentId) => {
      const parent = rowById.get(parentId);
      if (!parent) return;

      months.forEach((monthKey) => {
        const parentPrevisto = parent.valoresPorMes[monthKey]?.previsto ?? 0;
        const childSum = children.reduce(
          (sum, child) => sum + (child.valoresPorMes[monthKey]?.previsto ?? 0),
          0,
        );
        if (Math.abs(childSum) < 0.01) return;
        const ratio = parentPrevisto / childSum;
        if (!Number.isFinite(ratio) || Math.abs(ratio) > 1e6) return;
        children.forEach((child) => {
          if (!child.valoresPorMes[monthKey]) return;
          child.valoresPorMes[monthKey].previsto *= ratio;
        });
      });
    });

    return rows;
  }

  private applyDreStructuralCorrections(
    rows: Array<{
      id: string;
      codigo?: string | null;
      descricao: string;
      nivel: number;
      parentId?: string | null;
      sortOrder?: number;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    }>,
  ) {
    if (rows.length === 0) return rows;

    const normalizeText = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

    const byText = (needle: string) => {
      const key = normalizeText(needle);
      return rows.find((row) => normalizeText(row.descricao).includes(key));
    };
    const markerLabel = (row: (typeof rows)[number]) => {
      const match = normalizeText(row.descricao).match(/^\(([+\-=])\)\s*(.+)$/u);
      return match ? { sign: match[1], label: match[2] } : null;
    };
    const byMarkerExact = (sign: '+' | '-' | '=', label: string) => {
      const key = normalizeText(label);
      return rows.find((row) => {
        const marker = markerLabel(row);
        return marker?.sign === sign && marker.label === key;
      });
    };

    const reparent = (row: (typeof rows)[number] | undefined, parent: (typeof rows)[number] | undefined) => {
      if (!row || !parent || row.id === parent.id) return;
      row.parentId = parent.id;
      row.nivel = Math.max(0, Number(parent.nivel ?? 0) + 1);
    };

    const receitaBruta = byMarkerExact('+', 'RECEITA BRUTA') ?? byText('RECEITA BRUTA');
    const receitaSobreServicos = byMarkerExact('+', 'RECEITA SOBRE SERVICOS') ?? byText('RECEITA SOBRE SERVICOS');
    const receitaVendaMercadoInterno =
      byMarkerExact('+', 'RECEITA SOBRE VENDA MERCADO INTERNO') ?? byText('RECEITA SOBRE VENDA MERCADO INTERNO');
    const receitaVendaMercadoExterno =
      byMarkerExact('+', 'RECEITA SOBRE VENDA MERCADO EXTERNO') ?? byText('RECEITA SOBRE VENDA MERCADO EXTERNO');
    const outrasReceitasOperacionais =
      byMarkerExact('+', 'OUTRAS RECEITAS OPERACIONAIS') ?? byText('OUTRAS RECEITAS OPERACIONAIS');

    const deducoes = byMarkerExact('-', 'DEDUCOES') ?? byText('DEDUCOES');
    const fixasDesembolsaveis =
      byMarkerExact('-', 'CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS') ??
      byText('CUSTOS E DESPESAS FIXAS DESEMBOLS');
    const custosFixos = byMarkerExact('-', 'CUSTOS FIXOS') ?? byText('CUSTOS FIXOS');
    const custosComPessoal = byMarkerExact('-', 'CUSTOS COM PESSOAL') ?? byText('CUSTOS COM PESSOAL');
    const manutencaoMaquinas = byMarkerExact('-', 'MANUTENCAO DE MAQUINAS') ?? byText('MANUTENCAO DE MAQUINAS');
    const energiaEletrica = byMarkerExact('-', 'ENERGIA ELETRICA') ?? byText('ENERGIA ELETRICA');
    const convenioSejcDeap = byMarkerExact('-', 'CONVENIO - SEJC - DEAP') ?? byText('CONVENIO - SEJC - DEAP');
    const softwares = byMarkerExact('-', 'SOFTWARES') ?? byText('SOFTWARES');
    const despesasFixas = byMarkerExact('-', 'DESPESAS FIXAS') ?? byText('DESPESAS FIXAS');
    const despesasComPessoal = byMarkerExact('-', 'DESPESAS COM PESSOAL') ?? byText('DESPESAS COM PESSOAL');
    const despesasComerciais = byMarkerExact('-', 'DESPESAS COMERCIAIS') ?? byText('DESPESAS COMERCIAIS');
    const despesasViagens = byMarkerExact('-', 'DESPESAS COM VIAGENS') ?? byText('DESPESAS COM VIAGENS');
    const logistica = byMarkerExact('-', 'LOGISTICA') ?? byText('LOGISTICA');
    const impostos = byMarkerExact('-', 'IMPOSTOS') ?? rows.find((row) => {
      const text = normalizeText(row.descricao);
      return (
        text.includes('IMPOSTOS') &&
        !text.includes('IMPOSTOS SOBRE') &&
        !text.includes('IRPJ') &&
        !text.includes('CSLL')
      );
    });
    const impostosServicos = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text.includes('IMPOSTOS SOBRE') && text.includes('SERVICOS');
    });
    const impostosInterno = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text.includes('IMPOSTOS SOBRE') && text.includes('MERC') && text.includes('INTERNO');
    });
    const impostosExterno = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text.includes('IMPOSTOS SOBRE') && text.includes('MERC') && text.includes('EXTERNO');
    });
    const impostosOutrasReceitas = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text.includes('IMPOSTOS SOBRE') && text.includes('OUTRAS RECEITAS');
    });
    const despesasFinanceiras = byText('DESPESAS FINANCEIRAS');
    const receitasFinanceiras = byMarkerExact('+', 'RECEITAS FINANCEIRAS') ?? byText('RECEITAS FINANCEIRAS');
    const outrasDespesas = byMarkerExact('-', 'OUTRAS DESPESAS') ?? byText('OUTRAS DESPESAS');
    const outrosCustos =
      byMarkerExact('-', 'OUTROS CUSTOS') ??
      rows.find((row) => {
        const text = normalizeText(row.descricao);
        return text.includes('OUTROS CUSTOS') && text.includes('(-)');
      });
    const custosDiretosComPessoal = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text === '(-) CUSTOS DIRETOS COM PESSOAL';
    });
    const custosIndiretosComPessoal = rows.find((row) => {
      const text = normalizeText(row.descricao);
      return text === '(-) CUSTOS INDIRETOS COM PESSOAL';
    });
    const custosDiretosBreakdown = rows.filter((row) => {
      const text = normalizeText(row.descricao);
      return text.startsWith('(-) CUSTOS DIRETOS COM PESSOAL - ');
    });
    const custosIndiretosBreakdown = rows.filter((row) => {
      const text = normalizeText(row.descricao);
      return text.startsWith('(-) CUSTOS INDIRETOS COM PESSOAL - ');
    });
    const despesasComPessoalBreakdown = rows.filter((row) => {
      const text = normalizeText(row.descricao);
      return text.startsWith('(-) DESPESAS COM PESSOAL - ');
    });

    const prestacoesServico = rows
      .filter((row) => {
        const marker = markerLabel(row);
        return marker?.sign === '-' && marker.label === 'PRESTACAO DE SERVICOS';
      })
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
    if (prestacoesServico.length > 0 && custosFixos) {
      const underCustosFixos = prestacoesServico[0];
      reparent(underCustosFixos, custosFixos);
    }
    if (prestacoesServico.length > 1 && softwares) {
      const underSoftwares = prestacoesServico[prestacoesServico.length - 1];
      reparent(underSoftwares, softwares);
    }

    reparent(receitaSobreServicos, receitaBruta);
    reparent(receitaVendaMercadoInterno, receitaBruta);
    reparent(receitaVendaMercadoExterno, receitaBruta);
    reparent(outrasReceitasOperacionais, receitaBruta);

    reparent(impostos, deducoes);

    reparent(custosFixos, fixasDesembolsaveis);
    reparent(despesasFixas, fixasDesembolsaveis);

    reparent(custosComPessoal, custosFixos);
    reparent(manutencaoMaquinas, custosFixos);
    reparent(energiaEletrica, custosFixos);
    reparent(convenioSejcDeap, custosFixos);
    reparent(outrosCustos, custosFixos);

    reparent(despesasComPessoal, despesasFixas);
    reparent(despesasComerciais, despesasFixas);
    reparent(despesasViagens, despesasFixas);
    reparent(softwares, despesasFixas);
    reparent(logistica, despesasFixas);
    reparent(outrasDespesas, despesasFixas);

    reparent(custosDiretosComPessoal, custosComPessoal);
    reparent(custosIndiretosComPessoal, custosComPessoal);
    custosDiretosBreakdown.forEach((row) => reparent(row, custosDiretosComPessoal));
    custosIndiretosBreakdown.forEach((row) => reparent(row, custosIndiretosComPessoal));
    despesasComPessoalBreakdown.forEach((row) => reparent(row, despesasComPessoal));

    rows.forEach((row) => {
      const text = normalizeText(row.descricao);

      if (text.includes('IMPOSTOS SOBRE') && impostos) {
        reparent(row, impostos);
      }

      const isTaxDetail =
        text.includes('ISS SOBRE SERVICOS PRESTADOS') ||
        text.includes('PIS SOBRE SERVICOS PRESTADOS') ||
        text.includes('COFINS SOBRE SERVICOS PRESTADOS') ||
        text.includes('IMPOSTOS SOBRE SERVICOS PRESTADOS');

      if (isTaxDetail) {
        reparent(row, impostosServicos ?? impostos);
      }

      if (text.includes('PIS SOBRE RECEITA DE VENDA') || text.includes('COFINS SOBRE RECEITA DE VENDA')) {
        reparent(row, impostosInterno ?? impostosServicos ?? impostos);
      }

      if (text.includes('PIS S/OUTRAS RECEITAS') || text.includes('COFINS S/OUTRAS RECEITAS')) {
        reparent(row, impostosOutrasReceitas ?? impostos);
      }

      if (text.includes('PERDAS COM CREDITO DE ICMS')) {
        reparent(row, outrasDespesas);
      }

      if ((text.includes('IPI') || text.includes('ICMS')) && !text.includes('PERDAS COM CREDITO DE ICMS')) {
        const target =
          text.includes('EXTERNO')
            ? impostosExterno ?? impostosInterno ?? impostos
            : impostosInterno ?? impostosExterno ?? impostos;
        reparent(row, target);
      }

      const code = String(row.codigo ?? '').trim();
      if (
        text.includes('PIS S/DEPRECI') ||
        text.includes('COFINS S/DEPRECI') ||
        code === '6184' ||
        code === '6191'
      ) {
        reparent(row, outrosCustos);
      }

      if (text === '(-)PIS' || text === '(-) COFINS' || text === '(-) PIS' || text === '(-)COFINS') {
        reparent(row, outrasDespesas ?? outrosCustos ?? impostos);
      }

      const is90003Servico =
        String(row.codigo ?? '').trim() === '90003' ||
        text.startsWith('90003 - SERVICOS DE TERCEIROS') ||
        (text.includes('90003') && text.includes('SERVICOS DE TERCEIROS'));
      if (is90003Servico) {
        reparent(row, despesasFinanceiras);
        if (despesasFinanceiras) {
          const parentOrder = Number(despesasFinanceiras.sortOrder ?? 0);
          row.sortOrder = parentOrder + 0.001;
        }
      }

      const financialCode = String(row.codigo ?? '').trim();
      const isReceitaFinanceiraSubaccount =
        financialCode === '7203' ||
        financialCode === '7210' ||
        financialCode === '7232' ||
        financialCode === '8480' ||
        financialCode === '177081' ||
        text.includes('JUROS PAGOS SOBRE ARRENDAMENTO MERCANTIL') ||
        (text.includes('TARIFAS BANCARIAS') && text.includes('TAXAS')) ||
        text.includes('JUROS PAGOS') ||
        text.includes('DESCONTOS CONCEDIDOS') ||
        text.endsWith('IOF') ||
        text.includes(' - IOF');

      if (isReceitaFinanceiraSubaccount) {
        reparent(row, receitasFinanceiras);
      }
    });

    return rows;
  }

  private rollupHierarchyMonthValues<
    T extends {
      id: string;
      parentId?: string | null;
      valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
    },
  >(
    rows: T[],
    months: string[],
  ) {
    if (rows.length === 0) return rows;

    const byId = new Map(rows.map((row) => [row.id, row]));
    const childrenByParent = new Map<string, Array<(typeof rows)[number]>>();
    rows.forEach((row) => {
      if (!row.parentId) return;
      if (!byId.has(row.parentId)) return;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    });

    const visited = new Set<string>();
    const walk = (row: (typeof rows)[number]) => {
      if (visited.has(row.id)) return;
      const children = childrenByParent.get(row.id) ?? [];
      children.forEach((child) => walk(child));
      if (children.length > 0) {
        months.forEach((monthKey) => {
          let previsto = 0;
          let realizado = 0;
          let projetado = 0;
          children.forEach((child) => {
            const values = child.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
            previsto += values.previsto ?? 0;
            realizado += values.realizado ?? 0;
            projetado += values.projetado ?? 0;
          });
          // Consolidation rule: parent must mirror the exact sum of its children.
          // This keeps DRE hierarchy numerically consistent in every year/mode.
          row.valoresPorMes[monthKey] = {
            previsto,
            realizado,
            projetado,
          };
        });
      }
      visited.add(row.id);
    };

    rows.forEach((row) => {
      if (!row.parentId || !byId.has(row.parentId)) {
        walk(row);
      }
    });

    return rows;
  }
}
