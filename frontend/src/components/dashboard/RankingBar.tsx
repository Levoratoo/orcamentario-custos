import { useId, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { rechartsTheme } from '@/lib/recharts-theme';
import { cn } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RankingItem {
  name: string;
  value: number;
}

interface RankingBarProps {
  title: string;
  items: RankingItem[];
  onItemClick?: (item: RankingItem) => void;
  accent?: string;
}

export function RankingBar({ title, items, onItemClick, accent }: RankingBarProps) {
  const hasItems = items.length > 0;
  const barColor = accent ?? 'var(--accent)';
  const gradientId = useId().replace(/:/g, '');
  const chartData = useMemo(() => items.map((item) => ({ ...item, absValue: Math.abs(item.value) })), [items]);
  const totalAbs = useMemo(() => chartData.reduce((sum, item) => sum + item.absValue, 0), [chartData]);
  const topItem = chartData[0] ?? null;

  const formatCompactCurrency = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return `R$ ${Math.round(value)}`;
  };

  const truncateLabel = (value: string) => {
    const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
  };

  return (
    <Card className={cn('card-glow rounded-2xl', onItemClick && 'cursor-pointer')}>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {hasItems && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--accent)]">
              Maior {formatCompactCurrency(topItem?.value ?? 0)}
            </span>
            <span className="rounded-full border border-border/70 bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Total {formatCompactCurrency(totalAbs)}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="h-56">
        {!hasItems ? (
          <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3 text-muted-foreground">
            Sem dados disponiveis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 72, top: 8, bottom: 6 }} barCategoryGap={12}>
              <defs>
                <linearGradient id={`${gradientId}-bar`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={barColor} stopOpacity={0.96} />
                  <stop offset="100%" stopColor={barColor} stopOpacity={0.78} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} stroke={rechartsTheme.gridStroke} strokeDasharray="3 3" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.12, 1)]}
                tickFormatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                tick={rechartsTheme.axisTickSmall}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={rechartsTheme.axisTick}
                tickFormatter={(value: string) => truncateLabel(value)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(_, __, entry: any) => formatCurrency(Number(entry?.payload?.value ?? 0))}
                cursor={{ fill: 'var(--accent-soft)' }}
                contentStyle={rechartsTheme.tooltipContent}
                itemStyle={rechartsTheme.tooltipItem}
                labelStyle={rechartsTheme.tooltipLabel}
              />
              <Bar
                dataKey="absValue"
                fill={`url(#${gradientId}-bar)`}
                radius={[8, 8, 8, 8]}
                background={{ fill: 'var(--surface-2)', radius: 8 }}
                onClick={(data) => {
                  if (!onItemClick) return;
                  const payload = data as RankingItem;
                  onItemClick({ name: payload.name, value: payload.value });
                }}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                  fill={rechartsTheme.valueLabel.fill}
                  fontSize={rechartsTheme.valueLabel.fontSize}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
