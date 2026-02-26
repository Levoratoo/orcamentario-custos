'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BudgetSelector } from '@/components/shared/budget-selector';
import { MyAccountsTable } from '@/components/sponsors/MyAccountsTable';
import { EmptyState } from '@/components/shared/empty-state';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { useMySponsoredAccounts } from '@/hooks/use-my-sponsored-accounts';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';

export default function MyAccountsPage() {
  const router = useRouter();
  const { budgetId } = useSelectedBudget();
  const { data, isLoading } = useMySponsoredAccounts(budgetId);
  const { apiFetch } = useApiClient();
  const { data: budgets = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch) });
  const selected = budgets.find((item) => item.id === budgetId) ?? null;

  const [filters, setFilters] = useState({
    query: '',
    costCenterId: 'all',
    onlyPending: false,
    orderBy: 'total',
  });

  const costCenters = useMemo(() => {
    const map = new Map<string, string>();
    data?.rows.forEach((row) => {
      if (row.costCenterId && row.costCenterName) {
        map.set(row.costCenterId, row.costCenterName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  if (!budgetId) {
    return <EmptyState title="Selecione um orçamento" description="Escolha um orçamento para visualizar suas contas." action={<BudgetSelector />} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Minhas Contas</h1>
          <p className="text-sm text-muted-foreground">Detalhe seus itens mensais para compor o orçamento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetSelector />
          {selected && (
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              Budget selecionado: {selected.name}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">Carregando contas...</div>
      ) : data?.rows.length ? (
        <MyAccountsTable
          rows={data.rows}
          costCenters={costCenters}
          filters={filters}
          onFiltersChange={setFilters}
          onOpen={(row) => {
            const params = new URLSearchParams();
            if (row.costCenterId) params.set('costCenterId', row.costCenterId);
            router.push(`/contas/${row.accountCode}?${params.toString()}`);
          }}
        />
      ) : (
        <EmptyState title="Sem contas atribuídas" description="Nenhuma conta encontrada para o padrinho." />
      )}
    </div>
  );
}
