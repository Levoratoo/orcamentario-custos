import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSeriesPoint } from '@/lib/dashboardMapper';
import { formatCurrency } from '@/lib/format';
import { rechartsTheme } from '@/lib/recharts-theme';
import { useId } from 'react';
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface MonthlyLineProps {
  title: string;
  series: DashboardSeriesPoint[];
  best: DashboardSeriesPoint | null;
  worst: DashboardSeriesPoint | null;
  onPointClick?: (point: DashboardSeriesPoint) => void;
}

export function MonthlyLine({ title, series, best, worst, onPointClick }: MonthlyLineProps) {
  const bestMonth = best?.month;
  const worstMonth = worst?.month;
  const gradientId = useId().replace(/:/g, '');

  const formatCompactCurrency = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return `R$ ${Math.round(value)}`;
  };

  return (
    <Card className="card-glow rounded-2xl">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {best && (
            <span className="rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--accent)]">
              Pico {best.month} {formatCompactCurrency(best.value)}
            </span>
          )}
          {worst && (
            <span className="rounded-full border border-border/70 bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Vale {worst.month} {formatCompactCurrency(worst.value)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-64">
        {series.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3 text-muted-foreground">
            Sem dados disponiveis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <defs>
                <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                  <stop offset="60%" stopColor="var(--accent-2)" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={rechartsTheme.gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={rechartsTheme.axisTick}
              />
              <YAxis
                width={70}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompactCurrency}
                tick={rechartsTheme.axisTick}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                cursor={{ stroke: 'var(--accent-border)', strokeWidth: 1 }}
                contentStyle={rechartsTheme.tooltipContent}
                itemStyle={rechartsTheme.tooltipItem}
                labelStyle={rechartsTheme.tooltipLabel}
              />
              <Area
                type="monotone"
                dataKey="value"
                fill={`url(#${gradientId}-fill)`}
                strokeOpacity={0}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2.6}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload) return null;
                  const isBest = payload.month === bestMonth;
                  const isWorst = payload.month === worstMonth;
                  const color = isBest ? 'var(--accent)' : isWorst ? '#6f96be' : '#8ab3db';
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isBest || isWorst ? 5 : 2.2}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={isBest || isWorst ? 2 : 1}
                      onClick={() => onPointClick?.(payload as DashboardSeriesPoint)}
                      style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  fill: 'var(--accent)',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
