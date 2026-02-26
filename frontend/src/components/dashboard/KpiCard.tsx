import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/format';
import { DashboardSeriesPoint } from '@/lib/dashboardMapper';
import { Area, AreaChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: number;
  yoyValue: number | null;
  yoyPct: number | null;
  series: DashboardSeriesPoint[];
  onClick?: () => void;
}

export function KpiCard({ label, value, yoyValue, yoyPct, series, onClick }: KpiCardProps) {
  const isNegative = value < 0;
  const hasCompare = yoyValue !== null && yoyPct !== null;
  const positiveDelta = (yoyValue ?? 0) >= 0;

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm',
        onClick && 'cursor-pointer transition-colors hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)]',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={cn('text-2xl font-semibold text-foreground tabular-nums', isNegative && 'text-rose-600')}>
          {formatCurrency(value)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {hasCompare ? (
            <>
              <span className={cn('font-medium', positiveDelta ? 'text-[color:var(--accent)]' : 'text-rose-600')}>
                {formatCurrency(yoyValue!)} ({formatPercent(yoyPct!)})
              </span>
              <span className="rounded-full border border-border/70 bg-[color:var(--surface-1)] px-2 py-0 text-[10px] text-muted-foreground">
                vs ano anterior
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Sem base comparativa</span>
          )}
        </div>
        <div className="h-11 rounded-lg border border-border/60 bg-[color:var(--surface-1)] px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <Area type="monotone" dataKey="value" strokeOpacity={0} fill="var(--accent-soft)" />
              <Line type="monotone" dataKey="value" stroke="var(--accent-2)" strokeWidth={2.2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

