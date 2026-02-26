import {
  applyParentIdsByLevel,
  computeDeltaMetrics,
  computeExerciseAccumulatedFromSeries,
  computeProjectedSeries,
  computeProjectedValue,
  computeRealizedMonthlyFromSeries,
  decodeHtmlEntities,
  computeRealizedAccumulatedFromSeries,
  sanitizeLabel,
  normalizeDreHierarchy,
  inspectDreHierarchy,
} from './dre-utils';

describe('dre-utils', () => {
  it('applies parentId based on nivel order', () => {
    const rows: Array<{ id: string; nivel: number; parentId?: string | null }> = [
      { id: 'root', nivel: 0 },
      { id: 'child-1', nivel: 1 },
      { id: 'child-2', nivel: 2 },
      { id: 'child-3', nivel: 1 },
      { id: 'root-2', nivel: 0 },
    ];

    applyParentIdsByLevel(rows);

    expect(rows[0].parentId).toBeNull();
    expect(rows[1].parentId).toBe('root');
    expect(rows[2].parentId).toBe('child-1');
    expect(rows[3].parentId).toBe('root');
    expect(rows[4].parentId).toBeNull();
  });

  it('uses realizado for closed months and previsto for open months', () => {
    expect(computeProjectedValue(1, 100, 80, 1)).toBe(80);
    expect(computeProjectedValue(2, 100, 80, 1)).toBe(100);
  });

  it('uses previsto for all months when lastClosedMonth=0', () => {
    expect(computeProjectedValue(1, 100, 80, 0)).toBe(100);
    expect(computeProjectedValue(12, 55, 10, 0)).toBe(55);
  });

  it('uses realizado for all months when lastClosedMonth=12', () => {
    expect(computeProjectedValue(1, 100, 80, 12)).toBe(80);
    expect(computeProjectedValue(12, 55, 10, 12)).toBe(10);
  });

  it('computes projected series: realizado for closed, previsto for open', () => {
    const previsto = [10, 20, 30];
    const realizado = [100, 200, 300];
    const projected = computeProjectedSeries(previsto, realizado, 1);
    expect(projected[0]).toBe(100);
    expect(projected[1]).toBe(20);
    expect(projected[2]).toBe(30);
  });

  it('computes accumulated exercise with cutoff=3 and lastClosedMonth=1', () => {
    const previsto = [10, 20, 30];
    const realizado = [100, 200, 300];
    const value = computeExerciseAccumulatedFromSeries(previsto, realizado, 3, 1);
    // Jan (closed): realizado=100, Feb (open): previsto=20, Mar (open): previsto=30
    expect(value).toBe(150);
  });

  it('computes mensal exercise for selected month', () => {
    const realizado = [10, 20, 30, 40];
    expect(computeRealizedMonthlyFromSeries(realizado, 3)).toBe(30);
  });

  it('computes accumulated realized and handles delta by zero baseline', () => {
    const realizado = [10, 20, 30];
    expect(computeRealizedAccumulatedFromSeries(realizado, 3)).toBe(60);
    const delta = computeDeltaMetrics(100, 0);
    expect(delta.deltaValue).toBe(100);
    expect(delta.deltaPct).toBeNull();
  });

  it('decodes html entities safely', () => {
    expect(decodeHtmlEntities('&nbsp;&nbsp;(-) MANUTENÇÃO')).toBe('  (-) MANUTENÇÃO');
    expect(decodeHtmlEntities('A&amp;B')).toBe('A&B');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
    expect(decodeHtmlEntities('&quot;ok&quot;')).toBe('"ok"');
    expect(decodeHtmlEntities('&#39;ok&#39;')).toBe("'ok'");
    expect(decodeHtmlEntities('&#160;&#160;(-) ENERGIA')).toBe('\u00A0\u00A0(-) ENERGIA');
    expect(decodeHtmlEntities('&#xA0;&#xA0;ABC')).toBe('\u00A0\u00A0ABC');
  });

  it('sanitizes labels without breaking accents', () => {
    expect(sanitizeLabel('&nbsp;&nbsp;(-) MANUTENÇÃO DE MÁQUINAS')).toBe('(-) MANUTENÇÃO DE MÁQUINAS');
    expect(sanitizeLabel('&#160;&#160;(-) ENERGIA ELÉTRICA')).toBe('(-) ENERGIA ELÉTRICA');
    expect(sanitizeLabel('A&amp;B')).toBe('A&B');
    expect(sanitizeLabel('Çãáéíóú')).toBe('Çãáéíóú');
    expect(sanitizeLabel('A\u00A0\u00A0B')).toBe('A B');
  });

  it('normalizes hierarchy by level and builds path ids', () => {
    const rows: Array<{ id: string; nivel: number; descricao: string; parentId?: string | null; pathId?: string | null }> = [
      { id: '1', nivel: 0, descricao: 'ROOT' },
      { id: '1.1', nivel: 1, descricao: 'CHILD' },
      { id: '1.1.1', nivel: 2, descricao: 'GRAND' },
      { id: '2', nivel: 0, descricao: 'ROOT 2' },
    ];

    const normalized = normalizeDreHierarchy(rows);
    expect(normalized[0].parentId).toBeNull();
    expect(normalized[1].parentId).toBe('1');
    expect(normalized[2].parentId).toBe('1.1');
    expect(normalized[3].parentId).toBeNull();
    expect(normalized[2].pathId).toBe('1/1.1/1.1.1');
  });

  it('inspects invalid hierarchy', () => {
    const rows = [
      { id: '1', nivel: 0 },
      { id: '2', nivel: 0 },
      { id: '3', nivel: 0 },
      { id: '4', nivel: 0 },
    ];
    const check = inspectDreHierarchy(rows);
    expect(check.invalid).toBe(true);
  });
});
