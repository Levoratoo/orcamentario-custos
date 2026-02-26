import {
  computeIndicatorStatus,
  parseDateFlexible,
  parseIndicatorCodeAndName,
  parsePercentNormalized,
  parseSnapshotDateFromSheetName,
} from './bsc.utils';

describe('bsc.utils', () => {
  it('parses indicator code/name', () => {
    expect(parseIndicatorCodeAndName('F1.1 - Giro de Estoque')).toEqual({
      code: 'F1.1',
      name: 'Giro de Estoque',
    });
    expect(parseIndicatorCodeAndName('C2')).toEqual({
      code: 'C2',
      name: null,
    });
  });

  it('parses date formats', () => {
    expect(parseDateFlexible('08.04.25')).toBe('2025-04-08');
    expect(parseDateFlexible('2025-05-28')).toBe('2025-05-28');
    expect(parseSnapshotDateFromSheetName('1.project 08.04.25')).toBe('2025-04-08');
  });

  it('normalizes percentages', () => {
    expect(parsePercentNormalized('74%')).toBeCloseTo(0.74, 5);
    expect(parsePercentNormalized(74)).toBeCloseTo(0.74, 5);
    expect(parsePercentNormalized(0.74)).toBeCloseTo(0.74, 5);
  });

  it('computes status considering direction', () => {
    expect(computeIndicatorStatus(100, 100, 'HIGHER_IS_BETTER').status).toBe('VERDE');
    expect(computeIndicatorStatus(100, 92, 'HIGHER_IS_BETTER').status).toBe('AMARELO');
    expect(computeIndicatorStatus(100, 80, 'HIGHER_IS_BETTER').status).toBe('VERMELHO');
    expect(computeIndicatorStatus(80, 100, 'LOWER_IS_BETTER').status).toBe('VERMELHO');
  });
});

