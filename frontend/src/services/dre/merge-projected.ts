import { DreResult, DreRow } from '@/services/dre/types';
import { normalizeDreTree } from '@/services/dre/normalize-dre';

function getRowKey(row: DreRow) {
  return row.id;
}

export function mergeProjected(previsto: DreResult, realizado: DreResult, _closingMonth = 0): DreResult {
  const months = Array.from(new Set([...(previsto.months ?? []), ...(realizado.months ?? [])])).sort();
  const rowMap = new Map<string, DreRow>();

  const upsertRow = (row: DreRow) => {
    const key = getRowKey(row);
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        id: row.id,
        codigo: row.codigo,
        descricao: row.descricao,
        nivel: row.nivel,
        parentId: row.parentId ?? null,
        tipo: row.tipo,
        valoresPorMes: {},
      });
    }
    return rowMap.get(key)!;
  };

  previsto.rows.forEach((row) => {
    const target = upsertRow(row);
    months.forEach((monthKey) => {
      const prev = row.valoresPorMes[monthKey]?.previsto ?? 0;
      const existing = target.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      target.valoresPorMes[monthKey] = {
        ...existing,
        previsto: prev,
      };
    });
  });

  realizado.rows.forEach((row) => {
    const target = upsertRow(row);
    months.forEach((monthKey) => {
      const real = row.valoresPorMes[monthKey]?.realizado ?? 0;
      const existing = target.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      target.valoresPorMes[monthKey] = {
        ...existing,
        realizado: real,
      };
    });
  });

  rowMap.forEach((row) => {
    months.forEach((monthKey) => {
      const values = row.valoresPorMes[monthKey] ?? { previsto: 0, realizado: 0, projetado: 0 };
      row.valoresPorMes[monthKey] = {
        ...values,
        // Keep "projetado" field for compatibility, but store variation (Orcado - Realizado).
        projetado: Number(((values.previsto ?? 0) - (values.realizado ?? 0)).toFixed(2)),
      };
    });
  });

  const merged: DreResult = {
    rows: Array.from(rowMap.values()),
    summary: {
      totalReceitas: 0,
      totalCustosDespesas: 0,
      totalAnual: 0,
      setoresAtivos: 0,
      porMes: {},
    },
    bySector: [],
    months,
  };

  return normalizeDreTree({ rows: merged.rows, months }, 'projetado');
}
