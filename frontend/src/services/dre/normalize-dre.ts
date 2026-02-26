import { DreMode, DreResult, DreRow, DreTipo } from '@/services/dre/types';

function cleanLabel(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCodigo(label: string) {
  const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
  if (!match) return { codigo: undefined, descricao: label };
  return { codigo: match[1], descricao: match[2].trim() };
}

function inferTipo(label: string): DreTipo {
  const upper = label.toUpperCase();
  if (upper.includes('RECEITA')) return 'receita';
  if (upper.includes('CUSTO') || upper.includes('DESPESA')) return 'custo';
  return 'outros';
}

function resolveValueMode(value: { previsto: number; realizado: number; projetado?: number }, mode: DreMode) {
  if (mode === 'realizado') return value.realizado;
  if (mode === 'projetado') return (value as { projetado?: number }).projetado ?? value.previsto;
  if (mode === 'ambos') return value.previsto + value.realizado;
  return value.previsto;
}

function normalizeLabelKey(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildValueSignature(row: Pick<DreRow, 'valoresPorMes'>, months: string[]) {
  return months
    .map((monthKey) => {
      const month = row.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      const previsto = Number(month.previsto ?? 0);
      const realizado = Number(month.realizado ?? 0);
      const projetado = Number(month.projetado ?? month.previsto ?? 0);
      return `${previsto}|${realizado}|${projetado}`;
    })
    .join(';');
}

function removeNestedDuplicatesWhenRootExists(rows: DreRow[], months: string[]) {
  const rootKeys = new Set<string>();
  rows.forEach((row) => {
    if (row.parentId) return;
    const key = `${normalizeLabelKey(row.descricao)}|${buildValueSignature(row, months)}`;
    rootKeys.add(key);
  });

  return rows.filter((row) => {
    if (!row.parentId) return true;
    const key = `${normalizeLabelKey(row.descricao)}|${buildValueSignature(row, months)}`;
    return !rootKeys.has(key);
  });
}

export function normalizeDre(raw: any, year: number, mode: DreMode): DreResult {
  if (!raw) {
    return {
      rows: [],
      summary: {
        totalReceitas: 0,
        totalCustosDespesas: 0,
        totalAnual: 0,
        setoresAtivos: 0,
        porMes: {},
      },
      bySector: [],
      months: [],
    };
  }

  const columns = raw.columns as Array<{ label: string; kind: string }>;
  const monthColumns = columns
    .map((col, index) => {
      if (col.label === 'Total') return null;
      const [month, colYear] = col.label.split('/');
      if (!month || !colYear) return null;
      const monthKey = `${colYear}-${month}`;
      return { index, monthKey, kind: col.kind.toLowerCase() };
    })
    .filter(Boolean) as Array<{ index: number; monthKey: string; kind: string }>;

  const months = Array.from(new Set(monthColumns.map((col) => col.monthKey)));

  const rows: DreRow[] = raw.rows.map((row: any, index: number) => {
    const label = cleanLabel(String(row.label ?? ''));
    const { codigo, descricao } = parseCodigo(label);
    const valoresPorMes: DreRow['valoresPorMes'] = {};

    monthColumns.forEach((col) => {
      const rawValue = row.values?.[col.index] ?? 0;
      const value = typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0;
      if (!valoresPorMes[col.monthKey]) {
        valoresPorMes[col.monthKey] = { previsto: 0, realizado: 0 };
      }
      if (col.kind.includes('real')) {
        valoresPorMes[col.monthKey].realizado = value;
      } else {
        valoresPorMes[col.monthKey].previsto = value;
      }
    });

    const baseId = (codigo ?? descricao).trim();
    return {
      id: baseId || `${year}-${index}`,
      codigo,
      descricao,
      nivel: row.level ?? 0,
      parentId: null,
      tipo: inferTipo(label),
      valoresPorMes,
    };
  });

  const stack: Array<{ nivel: number; id: string }> = [];
  rows.forEach((row) => {
    while (stack.length > 0 && stack[stack.length - 1].nivel >= row.nivel) {
      stack.pop();
    }
    row.parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
    stack.push({ nivel: row.nivel, id: row.id });
  });

  const dedupedRows = removeNestedDuplicatesWhenRootExists(rows, months);
  const receitaRow = dedupedRows.find((row) => row.descricao.toUpperCase().includes('RECEITA BRUTA')) ?? null;
  const custoRows = dedupedRows.filter((row) => row.descricao.toUpperCase().includes('CUSTOS E DESPESAS'));

  const porMes: DreResult['summary']['porMes'] = {};
  months.forEach((monthKey) => {
    const receitaValue = receitaRow ? resolveValueMode(receitaRow.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0 }, mode) : 0;
    const custosValue = custoRows.reduce((sum, row) => {
      const value = resolveValueMode(row.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0 }, mode);
      return sum + value;
    }, 0);
    porMes[monthKey] = {
      receitas: receitaValue,
      custosDespesas: custosValue,
      total: receitaValue + custosValue,
    };
  });

  const totalReceitas = months.reduce((sum, key) => sum + (porMes[key]?.receitas ?? 0), 0);
  const totalCustosDespesas = months.reduce((sum, key) => sum + (porMes[key]?.custosDespesas ?? 0), 0);
  const totalAnual = totalReceitas + totalCustosDespesas;
  const setoresAtivos = totalAnual !== 0 ? 1 : 0;

  const bySector = [
    {
      setorId: 'geral',
      setorNome: 'Geral',
      contas: dedupedRows,
      porMes,
      total: totalAnual,
    },
  ];

  return {
    rows: dedupedRows,
    summary: {
      totalReceitas,
      totalCustosDespesas,
      totalAnual,
      setoresAtivos,
      porMes,
    },
    bySector,
    months,
  };
}

export function normalizeDreTree(
  raw: { rows: Array<Omit<DreRow, 'tipo'> & { tipo?: DreTipo }>; months: string[] } | null,
  mode: DreMode,
): DreResult {
  if (!raw) {
    return {
      rows: [],
      summary: {
        totalReceitas: 0,
        totalCustosDespesas: 0,
        totalAnual: 0,
        setoresAtivos: 0,
        porMes: {},
      },
      bySector: [],
      months: [],
    };
  }

  const rows: DreRow[] = raw.rows.map((row) => ({
    ...row,
    tipo: row.tipo ?? inferTipo(row.descricao),
  }));

  const months = raw.months;
  const dedupedRows = removeNestedDuplicatesWhenRootExists(rows, months);
  const receitaRow = dedupedRows.find((row) => row.descricao.toUpperCase().includes('RECEITA BRUTA')) ?? null;
  const custoRows = dedupedRows.filter((row) => row.descricao.toUpperCase().includes('CUSTOS E DESPESAS'));

  const porMes: DreResult['summary']['porMes'] = {};
  months.forEach((monthKey) => {
    const receitaValue = receitaRow ? resolveValueMode(receitaRow.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0 }, mode) : 0;
    const custosValue = custoRows.reduce((sum, row) => {
      const value = resolveValueMode(row.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0 }, mode);
      return sum + value;
    }, 0);
    porMes[monthKey] = {
      receitas: receitaValue,
      custosDespesas: custosValue,
      total: receitaValue + custosValue,
    };
  });

  const totalReceitas = months.reduce((sum, key) => sum + (porMes[key]?.receitas ?? 0), 0);
  const totalCustosDespesas = months.reduce((sum, key) => sum + (porMes[key]?.custosDespesas ?? 0), 0);
  const totalAnual = totalReceitas + totalCustosDespesas;
  const setoresAtivos = totalAnual !== 0 ? 1 : 0;

  const bySector = [
    {
      setorId: 'geral',
      setorNome: 'Geral',
      contas: dedupedRows,
      porMes,
      total: totalAnual,
    },
  ];

  return {
    rows: dedupedRows,
    summary: {
      totalReceitas,
      totalCustosDespesas,
      totalAnual,
      setoresAtivos,
      porMes,
    },
    bySector,
    months,
  };
}
