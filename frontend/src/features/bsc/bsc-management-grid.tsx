'use client';

import { useMemo } from 'react';
import type { BscManagementRow } from '@/services/backend';
import { formatCurrencyBRL } from '@/lib/formatters';
import { cn } from '@/lib/utils';

function monthLabel(month: number) {
  return String(month).padStart(2, '0');
}

export function BscManagementGrid({ rows }: { rows: BscManagementRow[] }) {
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  return (
    <div className="overflow-auto rounded-2xl border border-border/60">
      <table className="w-full min-w-[1200px] text-sm">
        <thead className="sticky top-0 z-10 bg-[color:var(--surface-2)]">
          <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-20 bg-[color:var(--surface-2)] px-3 py-2 text-left">Indicador</th>
            {months.map((month) => (
              <th key={month} className="px-3 py-2 text-center">{monthLabel(month)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.indicatorId} className="border-b border-border/40">
              <td className="sticky left-0 z-10 bg-background/95 px-3 py-2">
                <div className="font-medium">{row.code}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{row.name}</div>
              </td>
              {row.months.map((month) => (
                <td key={`${row.indicatorId}-${month.month}`} className="px-2 py-2 align-top">
                  <div className="space-y-1 text-right text-xs">
                    <div className="text-muted-foreground">{month.target == null ? '--' : formatCurrencyBRL(month.target)}</div>
                    <div>{month.actual == null ? '--' : formatCurrencyBRL(month.actual)}</div>
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          'inline-flex h-2.5 w-2.5 rounded-full',
                          month.status === 'VERDE' && 'bg-emerald-400',
                          month.status === 'AMARELO' && 'bg-amber-400',
                          month.status === 'VERMELHO' && 'bg-rose-400',
                          month.status === 'SEM_DADOS' && 'bg-slate-500',
                        )}
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

