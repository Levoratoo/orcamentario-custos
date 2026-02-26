'use client';

import { Card, CardContent } from '@/components/ui/card';

function formatTarget(item: any): string {
  if (item.targetValue == null) return item.rawValue ?? '--';
  const v = Number(item.targetValue);
  if (Math.abs(v) < 1) return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) >= 1_000) return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

export function IndicatorHeader({ indicator }: { indicator: any }) {
  const yearTargets = indicator.yearTargets ?? [];
  const perspective = indicator.objective?.perspective?.name ?? '';
  const objective = indicator.objective?.name ?? '';

  return (
    <Card className="border-sky-400/20 bg-[color:var(--surface-2)]/80">
      <CardContent className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Perspectiva</div>
            <div className="text-sm font-medium capitalize">{perspective.toLowerCase().replace(/_/g, ' ') || '--'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Objetivo</div>
            <div className="text-sm">{objective || '--'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Responsável</div>
            <div className="text-sm">{indicator.responsible ?? '--'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Alimentador</div>
            <div className="text-sm">{indicator.dataOwner ?? '--'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Processo</div>
            <div className="text-sm">{indicator.process ?? '--'}</div>
          </div>
        </div>

        {yearTargets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30">
            <span className="text-[11px] uppercase text-muted-foreground tracking-wide mr-1">Metas Anuais:</span>
            {yearTargets.map((item: any) => (
              <span key={item.year} className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-sky-500/10 px-2.5 py-1 text-xs">
                <span className="font-semibold text-sky-300">{item.year}</span>
                <span>{formatTarget(item)}</span>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
