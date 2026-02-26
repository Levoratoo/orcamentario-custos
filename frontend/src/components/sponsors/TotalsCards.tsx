'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';

interface TotalsCardsProps {
  actualTotal: number;
  scenarioTotal: number;
  varPct: number | null;
}

export function TotalsCards({ actualTotal, scenarioTotal, varPct }: TotalsCardsProps) {
  const varClass = varPct !== null && varPct < 0 ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="card-glow rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Tot. Ano Ant.</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-semibold">{formatMoney(actualTotal)}</CardContent>
      </Card>
      <Card className="card-glow rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Total Cenário</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-semibold">{formatMoney(scenarioTotal)}</CardContent>
      </Card>
      <Card className="card-glow rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground">Var. Ano Ant.</CardTitle>
        </CardHeader>
        <CardContent className={`text-lg font-semibold ${varClass}`}>
          {varPct === null ? '—' : `${varPct.toFixed(1)}%`}
        </CardContent>
      </Card>
    </div>
  );
}
