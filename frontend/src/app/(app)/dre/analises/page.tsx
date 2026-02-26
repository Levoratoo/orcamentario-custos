'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AnalyticsCards } from '@/features/dre-analytics/AnalyticsCards';

export default function DreAnalisesPage() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const params = useSearchParams();
  const yearFromQuery = Number(params.get('year'));
  const monthFromQuery = Number(params.get('month'));

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
  });

  const years = useMemo(
    () => Array.from(new Set(budgets.filter((budget) => budget.status === 'READY').map((budget) => budget.year))).sort((a, b) => b - a),
    [budgets],
  );

  const selectedYear = Number.isFinite(yearFromQuery) && years.includes(yearFromQuery)
    ? yearFromQuery
    : years[0] ?? new Date().getFullYear();

  const closingMonthQuery = useQuery({
    queryKey: ['closing-month', selectedYear],
    queryFn: () => backend.getClosingMonth(apiFetch, selectedYear),
    enabled: Number.isFinite(selectedYear),
  });

  const selectedMonth = Math.max(1, Math.min(12, closingMonthQuery.data?.closingMonth ?? 1));
  const activeMonth = Number.isFinite(monthFromQuery) ? Math.max(1, Math.min(12, monthFromQuery)) : selectedMonth;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-2 2xl:px-4">
      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-4 p-5">
          <PageHeader
            title="Analises DRE"
            description="Comparacao Acumulado (realizado ate mes fechado), Projetado (realizado fechado + previsto futuro) e Exercicio (mes fechado)."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(selectedYear)}
                  onValueChange={(value) => router.replace(`/dre/analises?year=${value}&month=${activeMonth}`)}
                >
                  <SelectTrigger className="h-10 w-[150px] border-border/70 bg-[color:var(--surface-1)] shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(activeMonth)}
                  onValueChange={(value) => router.replace(`/dre/analises?year=${selectedYear}&month=${value}`)}
                >
                  <SelectTrigger className="h-10 w-[150px] border-border/70 bg-[color:var(--surface-1)] shadow-sm">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        Mes {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className="h-10 border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 text-[color:var(--accent)]">
                  Mes fechado: {selectedMonth}
                </Badge>
              </div>
            }
          />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">Tela: Analises DRE</Badge>
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">Tela relacionada: Dashboard</Badge>
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              Mesma origem: DRE (/dre/tree?mode=DRE)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <AnalyticsCards year={selectedYear} month={activeMonth} />
    </div>
  );
}

