'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountDetailShell } from '@/components/sponsors/AccountDetailShell';
import { ItemsListPanel } from '@/components/sponsors/ItemsListPanel';
import { ProjectionGrid } from '@/components/sponsors/ProjectionGrid';
import { SummaryChart } from '@/components/sponsors/SummaryChart';
import { TotalsCards } from '@/components/sponsors/TotalsCards';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { useAccountBudgetDetails } from '@/hooks/use-account-budget-details';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { BudgetItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { toast } from 'sonner';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const { budgetId } = useSelectedBudget();
  const { apiFetch } = useApiClient();
  const accountCode = String(params.accountCode ?? '');
  const costCenterId = search.get('costCenterId');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useAccountBudgetDetails(accountCode, budgetId, costCenterId);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [status, setStatus] = useState('Salvo');

  const pendingValuesRef = useRef<Record<string, Record<number, number>>>({});
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (data?.items) {
      setItems(data.items);
    }
  }, [data?.items]);

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BudgetItem> }) => backend.updateBudgetItem(apiFetch, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (name: string) =>
      backend.createBudgetItem(apiFetch, { budgetId, accountCode, costCenterId, itemName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => backend.deleteBudgetItem(apiFetch, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const valuesMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Array<{ month: number; value: number }> }) =>
      backend.updateBudgetItemValues(apiFetch, id, values),
    onMutate: () => setStatus('Salvando...'),
    onSuccess: () => {
      setStatus('Salvo');
      queryClient.invalidateQueries({ queryKey: ['dre', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', budgetId] });
    },
    onError: () => {
      setStatus('Erro ao salvar');
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => backend.applyBudgetItemValue(apiFetch, id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ id, fromMonth }: { id: string; fromMonth: number }) =>
      backend.copyBudgetItemMonth(apiFetch, id, fromMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const distributeMutation = useMutation({
    mutationFn: ({ id, total }: { id: string; total: number }) =>
      backend.distributeBudgetItemTotal(apiFetch, id, total),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId] });
    },
  });

  const onValueChange = (itemId: string, month: number, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, monthValues: { ...item.monthValues, [month]: value }, total: item.total - (item.monthValues[month] ?? 0) + value }
          : item,
      ),
    );

    const pending = pendingValuesRef.current[itemId] ?? {};
    pending[month] = value;
    pendingValuesRef.current[itemId] = pending;

    if (timersRef.current[itemId]) {
      clearTimeout(timersRef.current[itemId]);
    }

    timersRef.current[itemId] = setTimeout(() => {
      const values = Object.entries(pendingValuesRef.current[itemId] ?? {}).map(([m, v]) => ({
        month: Number(m),
        value: v,
      }));
      if (values.length > 0) {
        valuesMutation.mutate({ id: itemId, values });
        pendingValuesRef.current[itemId] = {};
      }
    }, 700);
  };

  const handleApplyAll = (itemId: string, value: number) => {
    applyMutation.mutate({ id: itemId, value });
  };

  const handleCopy = (itemId: string, fromMonth: number) => {
    copyMutation.mutate({ id: itemId, fromMonth });
  };

  const handleDistribute = (itemId: string, total: number) => {
    distributeMutation.mutate({ id: itemId, total });
  };

  const handleZero = (itemId: string) => {
    const values = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: 0 }));
    valuesMutation.mutate({ id: itemId, values });
  };

  const summary = data?.totals;
  const title = data ? `Conta: ${data.account.code} - ${data.account.name}` : 'Conta';
  const subtitle = data?.costCenter ? `Setor: ${data.costCenter.name}` : 'Setor: —';

  const totalLabel = useMemo(() => {
    if (!summary) return '';
    return `${formatMoney(summary.scenarioTotal)} vs ${formatMoney(summary.actualPrevYearTotal)}`;
  }, [summary]);

  if (!budgetId) {
    return <div className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">Selecione um orçamento.</div>;
  }

  if (isLoading) {
    return <div className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (isError || !data) {
    return <div className="rounded-2xl border border-border/60 p-6 text-sm text-rose-400">Erro ao carregar detalhes.</div>;
  }

  return (
    <AccountDetailShell
      title={title}
      subtitle={subtitle}
      status={status}
      onBack={() => router.push('/minhas-contas')}
      actions={
        <Button variant="outline" onClick={() => toast('Exportacao em breve')}>
          Exportar CSV
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <ItemsListPanel
            items={items}
            canEdit={data.permission.canEdit}
            onCreate={(name) => createItemMutation.mutate(name)}
            onUpdate={(id, payload) => updateItemMutation.mutate({ id, data: payload })}
            onToggleActive={(id, active) => updateItemMutation.mutate({ id, data: { isActive: active } })}
            onToggleReimbursement={(id, value) => updateItemMutation.mutate({ id, data: { isReimbursement: value } })}
            onComment={(id, value) => updateItemMutation.mutate({ id, data: { comment: value } })}
          />
          {summary && (
            <>
              <TotalsCards
                actualTotal={summary.actualPrevYearTotal}
                scenarioTotal={summary.scenarioTotal}
                varPct={summary.varPctTotal}
              />
              <SummaryChart
                scenario={summary.scenarioMonthly}
                actual={summary.actualPrevYearMonthly}
                varPct={summary.varPctMonthly}
              />
              <div className="text-xs text-muted-foreground">Resumo: {totalLabel}</div>
            </>
          )}
        </div>
        <div className="space-y-4">
          <ProjectionGrid
            year={data.budget.year}
            items={items}
            canEdit={data.permission.canEdit}
            onValueChange={onValueChange}
            onApplyAll={handleApplyAll}
            onCopyFromMonth={handleCopy}
            onDistribute={handleDistribute}
            onZero={handleZero}
          />
        </div>
      </div>
    </AccountDetailShell>
  );
}
