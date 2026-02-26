import { mergeProjected } from './merge-projected';
import { mapDashboardData } from '../../lib/dashboardMapper';

const base = {
  summary: { totalReceitas: 0, totalCustosDespesas: 0, totalAnual: 0, setoresAtivos: 0, porMes: {} },
  bySector: [],
};

describe('mergeProjected', () => {
  it('sums projected when both sides exist', () => {
    const previsto = {
      ...base,
      months: ['2026-01'],
      rows: [
        { id: '1', descricao: 'A', nivel: 0, parentId: null, tipo: 'receita', valoresPorMes: { '2026-01': { previsto: 10, realizado: 0 } } },
      ],
    } as any;
    const realizado = {
      ...base,
      months: ['2026-01'],
      rows: [
        { id: '1', descricao: 'A', nivel: 0, parentId: null, tipo: 'receita', valoresPorMes: { '2026-01': { previsto: 0, realizado: 5 } } },
      ],
    } as any;
    const merged = mergeProjected(previsto, realizado);
    expect(merged.rows[0].valoresPorMes['2026-01'].projetado).toBe(15);
  });

  it('uses planned when realized missing', () => {
    const previsto = {
      ...base,
      months: ['2026-02'],
      rows: [
        { id: '2', descricao: 'B', nivel: 0, parentId: null, tipo: 'custo', valoresPorMes: { '2026-02': { previsto: 20, realizado: 0 } } },
      ],
    } as any;
    const realizado = { ...base, months: ['2026-02'], rows: [] } as any;
    const merged = mergeProjected(previsto, realizado);
    expect(merged.rows[0].valoresPorMes['2026-02'].projetado).toBe(20);
  });

  it('recomputes KPIs from merged dataset', () => {
    const previsto = {
      ...base,
      months: ['2026-01'],
      rows: [
        { id: 'receita', descricao: '(+) RECEITA BRUTA', nivel: 0, parentId: null, tipo: 'receita', valoresPorMes: { '2026-01': { previsto: 100, realizado: 0 } } },
        { id: 'custos', descricao: 'CUSTOS E DESPESAS', nivel: 0, parentId: null, tipo: 'custo', valoresPorMes: { '2026-01': { previsto: -40, realizado: 0 } } },
      ],
    } as any;
    const realizado = {
      ...base,
      months: ['2026-01'],
      rows: [
        { id: 'receita', descricao: '(+) RECEITA BRUTA', nivel: 0, parentId: null, tipo: 'receita', valoresPorMes: { '2026-01': { previsto: 0, realizado: 60 } } },
        { id: 'custos', descricao: 'CUSTOS E DESPESAS', nivel: 0, parentId: null, tipo: 'custo', valoresPorMes: { '2026-01': { previsto: 0, realizado: -10 } } },
      ],
    } as any;
    const projected = mergeProjected(previsto, realizado);
    const model = mapDashboardData(projected as any, null, 2026, 'projetado');
    const receitaBruta = model.kpis.find((kpi) => kpi.key === 'receita-bruta');
    expect(receitaBruta?.value).toBe(160);
  });
});
