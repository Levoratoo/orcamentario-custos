'use client';

import { Card, CardContent } from '@/components/ui/card';

export function IndicatorActionPlans({ actionPlans }: { actionPlans: any[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 text-sm font-semibold">Plano de Acao</div>
        <div className="space-y-2">
          {actionPlans.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem acoes importadas.</div>
          ) : null}
          {actionPlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="font-medium">{plan.fact || 'Sem fato'}</div>
              <div className="text-xs text-muted-foreground">{plan.cause || '--'}</div>
              <div className="mt-1">{plan.action || '--'}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {plan.owner || '--'} • {plan.dueDate ? String(plan.dueDate).slice(0, 10) : '--'}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
