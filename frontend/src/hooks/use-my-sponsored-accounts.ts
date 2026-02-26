'use client';

import { useQuery } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';

export function useMySponsoredAccounts(budgetId?: string | null) {
  const { apiFetch } = useApiClient();
  return useQuery({
    queryKey: ['sponsors', 'my-accounts', budgetId],
    enabled: Boolean(budgetId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: () => backend.getMySponsoredAccounts(apiFetch, budgetId!),
  });
}
