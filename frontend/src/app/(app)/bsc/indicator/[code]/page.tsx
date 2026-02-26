'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { BscNav } from '@/features/bsc/bsc-nav';
import { Button } from '@/components/ui/button';
import { IndicatorHeader } from '@/components/bsc/IndicatorHeader';
import { IndicatorMonthlyTable } from '@/components/bsc/IndicatorMonthlyTable';
import { IndicatorActionPlans } from '@/components/bsc/IndicatorActionPlans';
import { LoadingState } from '@/components/bsc/LoadingState';
import { ErrorState } from '@/components/bsc/ErrorState';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';

export default function BscIndicatorPage() {
  const { apiFetch } = useApiClient();
  const { user } = useAuth();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code);

  const query = useQuery({
    queryKey: ['bsc-indicator', code],
    queryFn: () => backend.getBscIndicator(apiFetch, code),
  });

  const updateActualMutation = useMutation({
    mutationFn: (payload: { year: number; month: number; actualValue: number | null }) =>
      backend.setBscIndicatorMonthActual(apiFetch, code, payload),
    onSuccess: async () => {
      await query.refetch();
      toast.success('Realizado mensal atualizado.');
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Falha ao atualizar realizado mensal.');
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: (payload: { year: number; month: number; targetValue: number | null }) =>
      backend.setBscIndicatorMonthTarget(apiFetch, code, payload),
    onSuccess: async () => {
      await query.refetch();
      toast.success('Meta mensal atualizada.');
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Falha ao atualizar meta mensal.');
    },
  });

  if (query.isLoading) {
    return <LoadingState label="Carregando indicador..." />;
  }

  if (query.isError || !query.data) {
    return <ErrorState label="Indicador nao encontrado." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/bsc/map">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para mapa
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-sky-400">{query.data.code}</span>
            <span className="mx-2 text-border">—</span>
            {query.data.name}
          </h1>
        </div>
        <BscNav />
      </div>

      <IndicatorHeader indicator={query.data} />
      <IndicatorMonthlyTable
        monthly={query.data.monthly ?? []}
        editable={user?.role === 'ADMIN' || user?.role === 'CONTROLLER'}
        onSaveActual={(payload) => updateActualMutation.mutateAsync(payload)}
        onSaveTarget={(payload) => updateTargetMutation.mutateAsync(payload)}
      />
      <IndicatorActionPlans actionPlans={query.data.actionPlans ?? []} />
    </div>
  );
}
