'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BscManagementRow } from '@/services/backend';

const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Math.abs(value) < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}`;
}

function statusTone(status: string) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'GREEN' || normalized === 'VERDE') {
    return {
      bg: 'bg-[color:var(--accent-soft)]/35 dark:bg-[#16314d]/88',
      border: 'border-[color:var(--accent-border)] dark:border-[#3f709f]',
      dot: 'bg-[color:var(--accent)]',
      text: 'text-[color:var(--accent)]',
      captionText: 'text-[color:var(--accent)]/85 dark:text-[#b9daf5]',
      metricText: 'text-[color:var(--accent)] dark:text-[#d7ebff]',
      valueWrap:
        'border-[color:var(--accent-border)]/80 bg-white/85 dark:bg-[#163451]/90 dark:border-[#4276ab]',
      valueText: 'text-[color:var(--accent)] dark:text-[#8dc6ff]',
      input:
        'border-[color:var(--accent-border)]/80 bg-white/85 text-[color:var(--accent)] shadow-inner shadow-sm focus-visible:ring-[color:var(--accent)]/35 dark:bg-[#163451]/90 dark:text-[#8dc6ff] dark:border-[#4276ab]',
      label: 'Passou',
    };
  }
  if (normalized === 'YELLOW' || normalized === 'AMARELO') {
    return {
      bg: 'bg-amber-100/75 dark:bg-amber-900/36',
      border: 'border-amber-300/75 dark:border-amber-700/80',
      dot: 'bg-amber-500 dark:bg-amber-400',
      text: 'text-amber-700 dark:text-amber-300',
      captionText: 'text-amber-700/85 dark:text-amber-200/88',
      metricText: 'text-amber-800 dark:text-amber-100',
      valueWrap: 'border-amber-300/80 bg-amber-50/90 dark:bg-amber-950/35 dark:border-amber-700/80',
      valueText: 'text-amber-700 dark:text-amber-300',
      input:
        'border-amber-300/80 bg-amber-50/90 text-amber-700 focus-visible:ring-amber-400/35 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-700/80',
      label: 'Atencao',
    };
  }
  if (normalized === 'RED' || normalized === 'VERMELHO') {
    return {
      bg: 'bg-rose-100/78 dark:bg-rose-900/35',
      border: 'border-rose-300/80 dark:border-rose-700/80',
      dot: 'bg-rose-500 dark:bg-rose-400',
      text: 'text-rose-600 dark:text-rose-300',
      captionText: 'text-rose-700/85 dark:text-rose-200/88',
      metricText: 'text-rose-800 dark:text-rose-100',
      valueWrap: 'border-rose-300/80 bg-rose-50/90 dark:bg-rose-950/35 dark:border-rose-700/80',
      valueText: 'text-rose-700 dark:text-rose-300',
      input:
        'border-rose-300/80 bg-rose-50/90 text-rose-700 focus-visible:ring-rose-400/35 dark:bg-rose-950/35 dark:text-rose-300 dark:border-rose-700/80',
      label: 'Faltou',
    };
  }
  return {
    bg: 'bg-[color:var(--surface-2)]/85',
    border: 'border-border/70',
    dot: 'bg-slate-400',
    text: 'text-muted-foreground',
    captionText: 'text-muted-foreground',
    metricText: 'text-foreground',
    valueWrap: 'border-border/70 bg-[color:var(--surface-1)]',
    valueText: 'text-muted-foreground',
    input:
      'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground shadow-inner shadow-sm focus-visible:ring-[color:var(--accent)]/35',
    label: 'Sem dado',
  };
}

function CellActualInput({
  year,
  month,
  value,
  disabled,
  className,
  onSave,
}: {
  year: number;
  month: number;
  value: number | null;
  disabled: boolean;
  className?: string;
  onSave: (payload: { year: number; month: number; actualValue: number | null }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = async () => {
    const normalized = draft.trim().replace(',', '.');
    const parsed = normalized === '' ? null : Number(normalized);
    if (parsed !== null && Number.isNaN(parsed)) return;
    if ((value == null && parsed == null) || (value != null && parsed === value)) return;
    setSaving(true);
    try {
      await onSave({ year, month, actualValue: parsed });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Input
      value={draft}
      disabled={disabled || saving}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
      }}
      placeholder="--"
      className={cn('h-6 w-full rounded-md px-1 text-center text-[11px] font-semibold', className)}
    />
  );
}

interface GroupedEntry {
  responsible: string;
  rows: BscManagementRow[];
}

export function ManagementGrid({
  year,
  rows,
  editable,
  saving,
  onSaveActual,
}: {
  year: number;
  rows: BscManagementRow[];
  editable: boolean;
  saving: boolean;
  onSaveActual?: (
    code: string,
    payload: { year: number; month: number; actualValue: number | null },
  ) => Promise<void>;
}) {
  const groups = useMemo<GroupedEntry[]>(() => {
    const map = new Map<string, BscManagementRow[]>();
    for (const row of rows) {
      const key = row.responsible ?? 'Sem responsavel';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([responsible, groupRows]) => ({ responsible, rows: groupRows }));
  }, [rows]);

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-[color:var(--surface-2)]/80 px-3 py-2 text-[10px]">
        <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">Topo: Meta</Badge>
        <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">Base: Realizado</Badge>
        <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">Rodape: Delta (Real - Meta)</Badge>
        <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">{rows.length} indicadores</Badge>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1460px] border-collapse text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-border/70 bg-[color:var(--surface-3)] text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="sticky left-0 z-30 min-w-[280px] bg-[color:var(--surface-3)] px-3 py-2 text-left">Indicador</th>
              <th className="px-2 py-2 text-center w-[82px]">Meta</th>
              {MONTH_LABELS.map((monthLabel) => (
                <th key={monthLabel} className="px-1 py-2 text-center w-[84px]">
                  {monthLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Sem indicadores para o recorte selecionado.
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <GroupBlock
                  key={group.responsible}
                  group={group}
                  year={year}
                  editable={editable}
                  saving={saving}
                  onSaveActual={onSaveActual}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupBlock({
  group,
  year,
  editable,
  saving,
  onSaveActual,
}: {
  group: GroupedEntry;
  year: number;
  editable: boolean;
  saving: boolean;
  onSaveActual?: (
    code: string,
    payload: { year: number; month: number; actualValue: number | null },
  ) => Promise<void>;
}) {
  return (
    <>
      <tr className="border-y border-border/70 bg-[color:var(--surface-2)]/78">
        <td colSpan={14} className="sticky left-0 z-10 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--accent)]">{group.responsible}</span>
            <span className="rounded-full border border-border/70 bg-[color:var(--surface-1)] px-2 py-0.5 text-[10px] text-muted-foreground">
              {group.rows.length} {group.rows.length === 1 ? 'indicador' : 'indicadores'}
            </span>
          </div>
        </td>
      </tr>

      {group.rows.map((row, index) => {
        const yearTarget = row.months.reduce((accumulator, month) => {
          if (month.target != null) return accumulator == null ? month.target : accumulator;
          return accumulator;
        }, null as number | null);

        return (
          <tr
            key={row.indicatorId}
            className={cn(
              'border-b border-border/40 transition-colors hover:bg-[color:var(--accent-soft)]/35',
              index % 2 === 0 ? 'bg-[color:var(--surface-1)]/96' : 'bg-[color:var(--surface-2)]/94',
            )}
          >
            <td className="sticky left-0 z-10 bg-[color:var(--surface-1)]/96 px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Link
                  href={`/bsc/indicator/${encodeURIComponent(row.code)}`}
                  className="inline-flex items-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2 py-0 text-[10px] font-semibold text-[color:var(--accent)] hover:bg-[color:var(--surface-2)]"
                >
                  {row.code}
                </Link>
                <span className="line-clamp-1 text-[12px] font-medium text-foreground">{row.name}</span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{row.objective}</div>
            </td>

            <td className="px-2 py-2 text-center text-[12px] font-semibold tabular-nums text-foreground">{fmt(yearTarget)}</td>

            {row.months.map((month) => {
              const tone = statusTone(month.status);
              return (
                <td key={month.month} className="px-0.5 py-1.5 text-center align-top">
                  <div className={cn('mx-auto w-[78px] rounded-xl border px-1.5 py-1 shadow-inner', tone.bg, tone.border)}>
                    <div className={cn('text-[9px] uppercase tracking-wide', tone.captionText)}>Meta</div>
                    <div className={cn('text-[10px] font-semibold tabular-nums', tone.metricText)}>{fmt(month.target)}</div>

                    <div className={cn('mt-0.5 text-[9px] uppercase tracking-wide', tone.captionText)}>Real</div>
                    {editable && onSaveActual ? (
                      <CellActualInput
                        year={year}
                        month={month.month}
                        value={month.actual}
                        disabled={saving}
                        className={tone.input}
                        onSave={(payload) => onSaveActual(row.code, payload)}
                      />
                    ) : (
                      <div
                        className={cn(
                          'rounded-md border px-1 py-0.5 text-[10px] font-semibold tabular-nums',
                          tone.valueWrap,
                          month.actual != null ? tone.valueText : 'text-muted-foreground',
                        )}
                      >
                        {fmt(month.actual)}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-center gap-1">
                      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                      <span className={cn('text-[9px] font-medium tabular-nums', tone.text)}>{fmtDelta(month.variance)}</span>
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

