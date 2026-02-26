'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BscPerspectiveMap } from '@/services/backend';

const labels: Record<string, string> = {
  FINANCEIRO: 'Financeiro',
  CLIENTE: 'Cliente',
  PROCESSOS: 'Processos',
  APRENDIZADO_CRESCIMENTO: 'Aprendizado & Crescimento',
};

export function BscPerspectiveBoard({ perspectives }: { perspectives: BscPerspectiveMap[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {perspectives.map((perspective) => (
        <Card key={perspective.id} className="border-emerald-400/20 bg-[color:var(--surface-2)]/80">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{labels[perspective.name] ?? perspective.name}</h3>
              <Badge variant="outline">{perspective.objectives.length} objetivos</Badge>
            </div>
            <div className="space-y-3">
              {perspective.objectives.map((objective) => (
                <div key={objective.id} className="rounded-xl border border-border/50 bg-background/30 p-3">
                  <div className="mb-2 text-sm font-medium">{objective.name}</div>
                  <div className="space-y-1">
                    {objective.indicators.map((indicator) => (
                      <Link
                        key={indicator.id}
                        href={`/bsc/indicator/${encodeURIComponent(indicator.code)}`}
                        className="flex items-center justify-between rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-emerald-400/10 hover:text-foreground"
                      >
                        <span className="font-medium">{indicator.code}</span>
                        <span className="ml-2 line-clamp-1">{indicator.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

