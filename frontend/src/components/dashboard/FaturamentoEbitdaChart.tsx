import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSeriesPoint } from '@/lib/dashboardMapper';
import { formatCurrencyBRL, formatCurrencyCompactBRL } from '@/lib/formatters';
import { rechartsTheme } from '@/lib/recharts-theme';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface FaturamentoEbitdaChartProps {
  faturamentoSeries: DashboardSeriesPoint[];
  ebitdaSeries: DashboardSeriesPoint[];
  onPointClick?: (point: {
    month: string;
    metric: 'faturamento' | 'ebitda';
    value: number;
  }) => void;
}

export function FaturamentoEbitdaChart({ faturamentoSeries, ebitdaSeries, onPointClick }: FaturamentoEbitdaChartProps) {
  const mapByMonth = new Map(ebitdaSeries.map((item) => [item.month, item.value]));
  const data = faturamentoSeries.map((item) => ({
    month: item.month,
    faturamento: item.value,
    ebitda: mapByMonth.get(item.month) ?? 0,
  }));

  return (
    <Card className="card-glow rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Faturamento x EBITDA
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid stroke={rechartsTheme.gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
            <YAxis
              tick={rechartsTheme.axisTickSmall}
              stroke={rechartsTheme.axisStroke}
              tickFormatter={(value) => formatCurrencyCompactBRL(Number(value ?? 0))}
            />
            <ReferenceLine y={0} stroke={rechartsTheme.referenceLineStroke} />
            <Tooltip
              formatter={(value) => formatCurrencyBRL(Number(value ?? 0))}
              contentStyle={rechartsTheme.tooltipContent}
              itemStyle={rechartsTheme.tooltipItem}
              labelStyle={rechartsTheme.tooltipLabel}
            />
            <Line
              type="monotone"
              dataKey="faturamento"
              name="Faturamento"
              stroke="var(--accent)"
              strokeWidth={2.6}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload || cx == null || cy == null) return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="var(--accent)"
                    stroke="#ffffff"
                    strokeWidth={1}
                    onClick={() =>
                      onPointClick?.({
                        month: String((payload as { month?: string }).month ?? ''),
                        metric: 'faturamento',
                        value: Number((payload as { faturamento?: number }).faturamento ?? 0),
                      })
                    }
                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                  />
                );
              }}
              activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#ffffff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="ebitda"
              name="EBITDA"
              stroke="#9a7c2f"
              strokeWidth={2.4}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload || cx == null || cy == null) return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="#9a7c2f"
                    stroke="#ffffff"
                    strokeWidth={1}
                    onClick={() =>
                      onPointClick?.({
                        month: String((payload as { month?: string }).month ?? ''),
                        metric: 'ebitda',
                        value: Number((payload as { ebitda?: number }).ebitda ?? 0),
                      })
                    }
                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                  />
                );
              }}
              activeDot={{ r: 5, fill: '#9a7c2f', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
