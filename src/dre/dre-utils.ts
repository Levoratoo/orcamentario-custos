export type DreRowLike = {
  id: string;
  nivel: number;
  parentId?: string | null;
};

const htmlNamedEntityMap: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
};
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

export function decodeHtmlEntities(input: string) {
  if (!input) return input;
  const namedDecoded = input.replace(/&([a-zA-Z]+|#39);/g, (match, entity) => {
    const replacement = htmlNamedEntityMap[entity];
    return replacement !== undefined ? replacement : match;
  });

  return namedDecoded
    .replace(/&#(\d+);/g, (_match, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCharCode(value) : _match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCharCode(value) : _match;
    });
}

export function sanitizeLabel(label: string) {
  const decoded = decodeHtmlEntities(label);
  return decoded
    .replace(/\u00A0/g, ' ')
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyParentIdsByLevel<T extends DreRowLike>(rows: T[]) {
  const stack: Array<{ nivel: number; id: string }> = [];
  rows.forEach((row) => {
    while (stack.length > 0 && stack[stack.length - 1].nivel >= row.nivel) {
      stack.pop();
    }
    row.parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
    stack.push({ nivel: row.nivel, id: row.id });
  });
  return rows;
}

export function computeProjectedValue(
  month: number,
  previsto: number,
  realizado: number,
  lastClosedMonth: number,
) {
  if (lastClosedMonth > 0 && month <= lastClosedMonth) {
    return realizado ?? 0;
  }
  return previsto ?? 0;
}

export function computeProjectedSeries(
  previstos: number[],
  realizados: number[],
  lastClosedMonth: number,
) {
  const size = Math.max(previstos.length, realizados.length);
  return Array.from({ length: size }, (_, index) => {
    const month = index + 1;
    return computeProjectedValue(month, previstos[index] ?? 0, realizados[index] ?? 0, lastClosedMonth);
  });
}

export function computeExerciseAccumulatedFromSeries(
  previstos: number[],
  realizados: number[],
  cutoffMonth: number,
  lastClosedMonth: number,
) {
  const limit = Math.max(0, Math.min(12, cutoffMonth));
  let total = 0;
  for (let month = 1; month <= limit; month += 1) {
    const previsto = previstos[month - 1] ?? 0;
    const realizado = realizados[month - 1] ?? 0;
    total += computeProjectedValue(month, previsto, realizado, lastClosedMonth);
  }
  return total;
}

export function computeRealizedAccumulatedFromSeries(realizados: number[], cutoffMonth: number) {
  const limit = Math.max(0, Math.min(12, cutoffMonth));
  let total = 0;
  for (let month = 1; month <= limit; month += 1) {
    total += realizados[month - 1] ?? 0;
  }
  return total;
}

export function computeRealizedMonthlyFromSeries(realizados: number[], month: number) {
  const selectedMonth = Math.max(1, Math.min(12, month));
  return realizados[selectedMonth - 1] ?? 0;
}

export function computeDeltaMetrics(current: number, previous: number) {
  const deltaValue = current - previous;
  const deltaPct = previous === 0 ? null : deltaValue / previous;
  return { deltaValue, deltaPct };
}

export function normalizeDreKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

type DreHierarchyRow = {
  id: string;
  nivel?: number | null;
  level?: number | null;
  parentId?: string | null;
  codigo?: string | null;
  descricao?: string | null;
  sortOrder?: number | null;
  pathId?: string | null;
  parentPathId?: string | null;
};

function deriveLevelFromCode(code: string | null | undefined) {
  if (!code) return 0;
  const normalized = String(code).trim();
  if (!normalized) return 0;
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length > 1) return parts.length - 1;
  return 0;
}

function coerceLevel(value: unknown) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function normalizeDreHierarchy<T extends DreHierarchyRow>(rows: T[]) {
  if (rows.length === 0) return rows;
  const withIndex = rows.map((row, index) => ({ row, index }));
  const idSet = new Set(withIndex.map(({ row }) => row.id));
  withIndex.sort((a, b) => {
    const aOrder = a.row.sortOrder ?? a.index;
    const bOrder = b.row.sortOrder ?? b.index;
    if (aOrder === bOrder) return a.index - b.index;
    return aOrder - bOrder;
  });

  const coercedLevels = withIndex.map(({ row }) => coerceLevel(row.nivel ?? row.level));
  const hasAnyLevel = coercedLevels.some((value) => value !== null);
  const derivedLevels = withIndex.map(({ row }) => deriveLevelFromCode(row.codigo));
  const derivedHasDepth = derivedLevels.some((value) => value > 0);

  const useDerived =
    !hasAnyLevel || (coercedLevels.filter((value) => (value ?? 0) === 0).length / rows.length > 0.9 && derivedHasDepth);

  const lastIdByLevel: Record<number, string> = {};
  const lastPathByLevel: Record<number, string> = {};
  const levelById: Record<string, number> = {};
  const pathById: Record<string, string> = {};

  const normalized = withIndex.map(({ row }, idx) => {
    const rawLevel = useDerived ? derivedLevels[idx] : (coercedLevels[idx] ?? 0);
    const explicitParentId = row.parentId && idSet.has(row.parentId) ? row.parentId : null;
    const parentId = explicitParentId ?? (rawLevel > 0 ? lastIdByLevel[rawLevel - 1] ?? null : null);
    const parentLevel = parentId ? levelById[parentId] : undefined;
    const level = parentId && Number.isFinite(parentLevel) ? Number(parentLevel) + 1 : rawLevel;
    const baseKey = row.codigo ? String(row.codigo) : String(row.id);
    const parentPathId = parentId
      ? pathById[parentId] ?? row.parentPathId ?? null
      : level > 0
        ? lastPathByLevel[level - 1] ?? null
        : null;
    const pathId = parentPathId ? `${parentPathId}/${baseKey}` : baseKey;
    lastIdByLevel[level] = row.id;
    lastPathByLevel[level] = pathId;
    levelById[row.id] = level;
    pathById[row.id] = pathId;
    return {
      ...row,
      nivel: level,
      parentId,
      pathId,
      parentPathId,
    };
  });

  return normalized;
}

export function inspectDreHierarchy(rows: Array<{ id: string; parentId?: string | null; nivel?: number | null }>) {
  const total = rows.length;
  const idSet = new Set(rows.map((row) => row.id));
  const roots = rows.filter((row) => !row.parentId).length;
  const missingParents = rows.filter((row) => row.parentId && !idSet.has(row.parentId)).length;
  const levelZero = rows.filter((row) => (row.nivel ?? 0) === 0).length;
  const levelZeroPct = total > 0 ? levelZero / total : 1;
  return {
    total,
    roots,
    missingParents,
    levelZeroPct,
    invalid: roots > total * 0.6 || missingParents > 0 || levelZeroPct > 0.9,
  };
}
