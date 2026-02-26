'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrencyBRL } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export function BscIndicatorDetail({ indicator }: { indicator: any }) {
  const years = indicator.yearTargets ?? [];
  const monthly = indicator.monthly ?? [];
  const actions = indicator.actionPlans ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-emerald-400/20 bg-[color:var(--surface-2)]/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Código</div>
            <div className="text-lg font-semibold">{indicator.code}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Responsável</div>
            <div>{indicator.responsible ?? '--'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Alimentador</div>
            <div>{indicator.dataOwner ?? '--'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Processo</div>
            <div>{indicator.process ?? '--'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold">Metas Anuais</div>
          <div className="flex flex-wrap gap-2">
            {years.map((item: any) => (
              <div key={item.year} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="mr-2 text-muted-foreground">{item.year}</span>
                <span>{item.targetValue == null ? item.rawValue ?? '--' : formatCurrencyBRL(Number(item.targetValue))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold">Performance Mensal</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-2 text-left">Período</th>
                  <th className="px-2 py-2 text-right">Meta</th>
                  <th className="px-2 py-2 text-right">Realizado</th>
                  <th className="px-2 py-2 text-right">M vs R</th>
                  <th className="px-2 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((item: any) => (
                  <tr key={`${item.year}-${item.month}`} className="border-b border-border/30">
                    <td className="px-2 py-2">{String(item.month).padStart(2, '0')}/{item.year}</td>
                    <td className="px-2 py-2 text-right">{item.target == null ? '--' : formatCurrencyBRL(item.target)}</td>
                    <td className="px-2 py-2 text-right">{item.actual == null ? '--' : formatCurrencyBRL(item.actual)}</td>
                    <td className="px-2 py-2 text-right">{item.variance == null ? '--' : `${(item.variance * 100).toFixed(1)}%`}</td>
                    <td className="px-2 py-2 text-right">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs',
                          item.status === 'VERDE' && 'bg-emerald-500/20 text-emerald-300',
                          item.status === 'AMARELO' && 'bg-amber-500/20 text-amber-300',
                          item.status === 'VERMELHO' && 'bg-rose-500/20 text-rose-300',
                          item.status === 'SEM_DADOS' && 'bg-slate-500/20 text-slate-300',
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-semibold">Plano de Ação</div>
          <div className="space-y-2">
            {actions.length === 0 && <div className="text-sm text-muted-foreground">Sem ações importadas.</div>}
            {actions.map((plan: any) => (
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
    </div>
  );
}

