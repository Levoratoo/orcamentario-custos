import type { CSSProperties } from 'react';

export const rechartsTheme = {
  gridStroke: 'var(--border-base)',
  axisStroke: 'var(--border-base)',
  referenceLineStroke: 'var(--border-base)',
  axisTick: { fill: 'var(--text-secondary)', fontSize: 11 },
  axisTickSmall: { fill: 'var(--text-secondary)', fontSize: 10 },
  valueLabel: { fill: 'var(--foreground)', fontSize: 10 },
  legend: { fontSize: 12, color: 'var(--foreground)' } as CSSProperties,
  tooltipContent: {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-base)',
    borderRadius: 12,
    color: 'var(--foreground)',
  } as CSSProperties,
  tooltipLabel: { color: 'var(--muted-foreground)' } as CSSProperties,
  tooltipItem: { color: 'var(--foreground)' } as CSSProperties,
} as const;
