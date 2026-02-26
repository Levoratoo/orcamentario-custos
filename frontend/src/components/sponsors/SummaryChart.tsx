'use client';

import { rechartsTheme } from '@/lib/recharts-theme';
import { ComposedChart, Bar, CartesianGrid, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface SummaryChartProps {
  scenario: Array<{ month: number; value: number }>;
  actual: Array<{ month: number; value: number }>;
  varPct: Array<{ month: number; value: number | null }>;
}

export function SummaryChart({ scenario, actual, varPct }: SummaryChartProps) {
  const data = scenario.map((item, index) => ({
    month: String(item.month).padStart(2, '0'),
    scenario: item.value,
    actual: actual[index]?.value ?? 0,
    varPct: varPct[index]?.value ?? null,
  }));

  return (
    <div className="h-72 rounded-2xl border border-border/60 bg-[color:var(--surface-2)] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke={rechartsTheme.gridStroke} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={rechartsTheme.axisTick}
            stroke={rechartsTheme.axisStroke}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip contentStyle={rechartsTheme.tooltipContent} labelStyle={rechartsTheme.tooltipLabel} itemStyle={rechartsTheme.tooltipItem} />
          <Legend wrapperStyle={rechartsTheme.legend} />
          <Bar yAxisId="left" dataKey="actual" name="Realizado Ano Ant." fill="#334155" />
          <Bar yAxisId="left" dataKey="scenario" name="Cenario" fill="var(--accent-2)" />
          <Line yAxisId="right" dataKey="varPct" name="Var. Ano Ant." stroke="#38bdf8" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
