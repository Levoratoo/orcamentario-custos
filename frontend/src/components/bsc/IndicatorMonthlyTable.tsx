'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { rechartsTheme } from '@/lib/recharts-theme';
import { cn } from '@/lib/utils';
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatValue(v: number | null | undefined): string {
  if (v == null) return '--';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function varianceColor(pct: number | null): string {
  if (pct == null) return '';
  if (pct >= 0) return 'text-emerald-400';
  if (pct >= -0.1) return 'text-amber-400';
  return 'text-rose-400';
}

function varianceBg(pct: number | null): string {
  if (pct == null) return '';
  if (pct >= 0) return 'bg-emerald-500/10';
  if (pct >= -0.1) return 'bg-amber-500/10';
  return 'bg-rose-500/10';
}

function CellInput({
  value,
  disabled,
  onCommit,
  className,
}: {
  value: number | null;
  disabled?: boolean;
  onCommit: (parsed: number | null) => Promise<void>;
  className?: string;
}) {
  const formatForInput = (v: number | null): string => {
    if (v == null) return '';
    return (Math.round(v * 100) / 100).toFixed(2);
  };
  const [draft, setDraft] = useState<string>(formatForInput(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(formatForInput(value));
  }, [value]);

  const commit = async () => {
    const normalized = draft.replace(',', '.').trim();
    const parsedRaw = normalized === '' ? null : Number(normalized);
    if (parsedRaw !== null && Number.isNaN(parsedRaw)) return;
    const parsed = parsedRaw == null ? null : Math.round(parsedRaw * 100) / 100;
    const currentRounded = value == null ? null : Math.round(value * 100) / 100;
    if ((currentRounded == null && parsed == null) || (currentRounded != null && parsed === currentRounded)) return;
    setSaving(true);
    try {
      await onCommit(parsed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Input
      value={draft}
      disabled={disabled || saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      placeholder="--"
      className={cn('h-6 w-[70px] text-center text-xs p-0.5', className)}
    />
  );
}

interface MonthlyItem {
  year: number;
  month: number;
  target: number | null;
  actual: number | null;
  variance: number | null;
  status: string;
}

export function IndicatorMonthlyTable({
  monthly,
  editable = false,
  onSaveActual,
  onSaveTarget,
}: {
  monthly: MonthlyItem[];
  editable?: boolean;
  onSaveActual?: (payload: { year: number; month: number; actualValue: number | null }) => Promise<void>;
  onSaveTarget?: (payload: { year: number; month: number; targetValue: number | null }) => Promise<void>;
}) {
  const years = useMemo(() => {
    const s = new Set(monthly.map((m) => m.year));
    return Array.from(s).sort((a, b) => a - b);
  }, [monthly]);

  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? 2025);

  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const yearData = useMemo(() => {
    const byMonth = new Map<number, MonthlyItem>();
    monthly.filter((m) => m.year === selectedYear).forEach((m) => byMonth.set(m.month, m));
    return Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1) ?? { year: selectedYear, month: i + 1, target: null, actual: null, variance: null, status: 'NO_DATA' });
  }, [monthly, selectedYear]);

  const position = useMemo(() => {
    const targets = yearData.map((d) => d.target).filter((v): v is number => v != null);
    const actuals = yearData.map((d) => d.actual).filter((v): v is number => v != null);
    const avgTarget = targets.length > 0 ? targets.reduce((a, b) => a + b, 0) / targets.length : null;
    const avgActual = actuals.length > 0 ? actuals.reduce((a, b) => a + b, 0) / actuals.length : null;
    const variance = avgTarget != null && avgActual != null && avgTarget !== 0 ? avgActual / avgTarget - 1 : null;
    return { target: avgTarget, actual: avgActual, variance };
  }, [yearData]);

  const chartData = useMemo(
    () =>
      yearData.map((d, i) => ({
        month: MONTH_LABELS[i],
        Meta: d.target,
        Realizado: d.actual,
        'M vs R': d.variance != null ? +(d.variance * 100).toFixed(1) : null,
      })),
    [yearData],
  );

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <div className="flex gap-2">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={cn(
                'rounded-md border px-3 py-1 text-sm font-medium transition-colors',
                y === selectedYear
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-border/60 text-muted-foreground hover:border-emerald-400/50',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Performance Mensal — {selectedYear}</span>
            {editable && (
              <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                Clique nos valores para editar
              </span>
            )}
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[850px] text-xs">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase text-muted-foreground">
                  <th className="px-1.5 py-1.5 text-left w-24"></th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="px-1.5 py-1.5 text-center w-[60px]">{m}</th>
                  ))}
                  <th className="px-1.5 py-1.5 text-center w-[70px] border-l border-border/40">Posição</th>
                </tr>
              </thead>
              <tbody>
                {/* META row */}
                <tr className="border-b border-border/30 bg-sky-500/5">
                  <td className="px-1.5 py-1.5 font-semibold text-sky-300">META</td>
                  {yearData.map((d, i) => (
                    <td key={i} className="px-1.5 py-1.5 text-center">
                      {editable && onSaveTarget ? (
                        <CellInput
                          value={d.target}
                          onCommit={(v) => onSaveTarget({ year: d.year, month: d.month, targetValue: v })}
                          className="border-sky-500/30 focus-visible:ring-sky-400/50"
                        />
                      ) : (
                        formatValue(d.target)
                      )}
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 text-center font-semibold border-l border-border/40">{formatValue(position.target)}</td>
                </tr>
                {/* REALIZADO row */}
                <tr className="border-b border-border/30 bg-orange-500/5">
                  <td className="px-1.5 py-1.5 font-semibold text-orange-300">REALIZADO</td>
                  {yearData.map((d, i) => (
                    <td key={i} className="px-1.5 py-1.5 text-center">
                      {editable && onSaveActual ? (
                        <CellInput
                          value={d.actual}
                          onCommit={(v) => onSaveActual({ year: d.year, month: d.month, actualValue: v })}
                          className="border-orange-500/30 focus-visible:ring-orange-400/50"
                        />
                      ) : (
                        formatValue(d.actual)
                      )}
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 text-center font-semibold border-l border-border/40">{formatValue(position.actual)}</td>
                </tr>
                {/* M vs R row */}
                <tr className="border-b border-border/30">
                  <td className="px-1.5 py-1.5 font-semibold text-muted-foreground">M vs R</td>
                  {yearData.map((d, i) => (
                    <td key={i} className={cn('px-1.5 py-1.5 text-center font-medium', varianceColor(d.variance), varianceBg(d.variance))}>
                      {d.variance == null ? '--' : `${(d.variance * 100).toFixed(1)}%`}
                    </td>
                  ))}
                  <td className={cn('px-1.5 py-1.5 text-center font-semibold border-l border-border/40', varianceColor(position.variance))}>
                    {position.variance == null ? '--' : `${(position.variance * 100).toFixed(1)}%`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-semibold">Meta vs Realizado</div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={rechartsTheme.axisTickSmall}
                stroke={rechartsTheme.axisStroke}
                unit="%"
              />
              <Tooltip
                contentStyle={rechartsTheme.tooltipContent}
                labelStyle={rechartsTheme.tooltipLabel}
                itemStyle={rechartsTheme.tooltipItem}
              />
              <Legend wrapperStyle={rechartsTheme.legend} />
              <Bar yAxisId="left" dataKey="Meta" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={18} />
              <Bar yAxisId="left" dataKey="Realizado" fill="#f97316" radius={[3, 3, 0, 0]} barSize={18} />
              <Line yAxisId="right" type="monotone" dataKey="M vs R" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
