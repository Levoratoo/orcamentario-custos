'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RoleGuard } from '@/components/shared/role-guard';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatAuditNumber = (value: unknown): string => {
  const numberValue = toNumber(value);
  if (numberValue === null) return '-';
  return numberValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replaceAll(',', '.');
};

const isValueOk = (value: unknown): boolean => {
  const numberValue = toNumber(value);
  if (numberValue === null) return false;
  return Math.abs(numberValue) < 0.01;
};

export default function AuditPage() {
  const { apiFetch } = useApiClient();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const [runToken, setRunToken] = useState(0);

  const budgetsQuery = useQuery({
    queryKey: ['audit-budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
  });

  const budgets2026 = useMemo(
    () =>
      (budgetsQuery.data ?? [])
        .filter((budget) => budget.year === 2026 && budget.kind === 'BUDGET' && budget.status === 'READY')
        .sort((a, b) => {
          if ((a.isActive ? 1 : 0) !== (b.isActive ? 1 : 0)) return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [budgetsQuery.data],
  );

  const activeBudgetId = selectedBudgetId || budgets2026[0]?.id || '';

  const auditQuery = useQuery({
    queryKey: ['dre-sheet-audit', 2026, activeBudgetId, runToken],
    queryFn: () => backend.getDreAudit(apiFetch, 2026, activeBudgetId || undefined),
    enabled: Boolean(activeBudgetId),
  });

  const fixMutation = useMutation({
    mutationFn: () => backend.autoFixDreAudit(apiFetch, { year: 2026, budgetId: activeBudgetId || undefined }),
    onSuccess: async (result) => {
      toast.success(`Ajuste concluido: ${result.updatedRows} contas / ${result.updatedCells} celulas.`);
      setRunToken((prev) => prev + 1);
      await auditQuery.refetch();
    },
    onError: () => toast.error('Nao foi possivel ajustar o DRE automaticamente.'),
  });

  const runAudit = async () => {
    if (!activeBudgetId) {
      toast.error('Selecione um orcamento 2026.');
      return;
    }
    const result = await auditQuery.refetch();
    if (result.isError) {
      toast.error('Falha ao executar auditoria.');
      return;
    }
    const total = result.data?.summary.totalIssues ?? 0;
    if (total === 0) {
      toast.success('Auditoria concluida: nenhuma divergencia.');
    } else {
      toast.warning(`Auditoria concluida: ${total} divergencia(s).`);
    }
  };

  const valueDivergenceIssues = useMemo(
    () => (auditQuery.data?.issues ?? []).filter((issue) => issue.type === 'MONTH_VALUE_MISMATCH'),
    [auditQuery.data?.issues],
  );

  const issueStats = useMemo(() => {
    const ok = valueDivergenceIssues.filter((issue) => isValueOk(issue.delta)).length;
    const wrong = valueDivergenceIssues.length - ok;
    return { ok, wrong };
  }, [valueDivergenceIssues]);

  return (
    <RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            DRE 2026 vs planilha <span className="font-medium">dre expandida</span>, com ajuste automatico.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-[color:var(--accent)] hover:bg-[color:var(--surface-3)]">
              Tela: Dashboard
            </Badge>
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-[color:var(--accent)] hover:bg-[color:var(--surface-3)]">
              Tela: Analises DRE
            </Badge>
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]">
              Mesma origem de dados: DRE (/dre/tree?mode=DRE)
            </Badge>
          </div>
        </div>

        <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px]">
              <Select value={activeBudgetId} onValueChange={setSelectedBudgetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o orcamento 2026" />
                </SelectTrigger>
                <SelectContent>
                  {budgets2026.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.name} ({budget.year}){budget.isActive ? ' [Ativo]' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runAudit} disabled={auditQuery.isFetching || !activeBudgetId}>
              {auditQuery.isFetching ? 'Varrendo...' : 'Executar Varredura'}
            </Button>
            <Button
              variant="default"
              onClick={() => fixMutation.mutate()}
              disabled={fixMutation.isPending || !activeBudgetId}
              className="border border-[color:var(--accent-border)] bg-[color:var(--accent-2)] text-white hover:bg-[color:var(--accent)]"
            >
              {fixMutation.isPending ? 'Ajustando...' : 'Ajustar Automaticamente'}
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-2)]/75 p-4">
          {auditQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                  <div className={`mt-1 text-sm font-semibold ${auditQuery.data.summary.totalIssues > 0 ? 'text-rose-400' : 'text-[color:var(--accent)]'}`}>
                    {auditQuery.data.summary.totalIssues > 0 ? 'Com divergencia' : 'Tudo certo'}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/5 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-rose-400/90">Com erro</div>
                  <div className="mt-1 text-sm font-semibold text-rose-400">{issueStats.wrong}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[color:var(--accent)]/90">Conferido OK</div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--accent)]">{issueStats.ok}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Gerado em</div>
                  <div className="mt-1 text-xs text-foreground">
                    {new Date(auditQuery.data.generatedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              {valueDivergenceIssues.length === 0 ? (
                <div className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 py-2 text-sm font-medium text-[color:var(--accent)]">
                  Nenhuma divergencia encontrada.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto rounded-xl border border-border/60 bg-[color:var(--surface-1)]/90">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[color:var(--surface-3)]">
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Conta DRE</th>
                        <th className="px-3 py-2 text-right">Planilha</th>
                        <th className="px-3 py-2 text-right">Divergencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valueDivergenceIssues.map((issue) => {
                        const rowOk = isValueOk(issue.delta);
                        return (
                          <tr
                            key={issue.id}
                            className={`border-b border-border/40 align-top transition-colors ${
                              rowOk ? 'bg-[color:var(--accent-soft)]/40 hover:bg-[color:var(--accent-soft)]/65' : 'bg-rose-500/5 hover:bg-rose-500/10'
                            }`}
                          >
                            <td className={`px-3 py-2 font-medium ${rowOk ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}>
                              {issue.descricao ?? '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-foreground">{formatAuditNumber(issue.expected)}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${rowOk ? 'text-[color:var(--accent)]' : 'text-rose-500'}`}>
                              {formatAuditNumber(issue.delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Selecione o orcamento e execute a varredura.
            </div>
          )}
        </Card>
      </div>
    </RoleGuard>
  );
}


