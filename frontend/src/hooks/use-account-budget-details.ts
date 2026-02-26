'use client';

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';

export function useAccountBudgetDetails(accountCode?: string, budgetId?: string | null, costCenterId?: string | null) {
  const { apiFetch } = useApiClient();
  return useQuery({
    queryKey: ['sponsors', 'account-details', accountCode, budgetId, costCenterId],
    enabled: Boolean(accountCode && budgetId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: () => backend.getAccountBudgetDetails(apiFetch, accountCode!, budgetId!, costCenterId ?? null),
  });
}
