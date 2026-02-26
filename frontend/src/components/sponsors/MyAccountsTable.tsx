'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SponsorAccountRow } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { calcDeltaPct } from '@/lib/calc';

interface MyAccountsTableProps {
  rows: SponsorAccountRow[];
  costCenters: Array<{ id: string; name: string }>;
  onOpen: (row: SponsorAccountRow) => void;
  filters: {
    query: string;
    costCenterId: string;
    onlyPending: boolean;
    orderBy: string;
  };
  onFiltersChange: (next: MyAccountsTableProps['filters']) => void;
}

export function MyAccountsTable({ rows, costCenters, onOpen, filters, onFiltersChange }: MyAccountsTableProps) {
  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    let data = rows.filter((row) => {
      if (!query) return true;
      const target = `${row.accountCode} ${row.accountName} ${row.costCenterName ?? ''}`.toLowerCase();
      return target.includes(query);
    });
    if (filters.costCenterId !== 'all') {
      data = data.filter((row) => row.costCenterId === filters.costCenterId);
    }
    if (filters.onlyPending) {
      data = data.filter((row) => row.status === 'PENDING');
    }
    if (filters.orderBy === 'total') {
      data = [...data].sort((a, b) => b.scenarioTotal - a.scenarioTotal);
    }
    if (filters.orderBy === 'var') {
      data = [...data].sort((a, b) => (b.varPct ?? 0) - (a.varPct ?? 0));
    }
    if (filters.orderBy === 'pending') {
      data = [...data].sort((a, b) => Number(a.status !== 'PENDING') - Number(b.status !== 'PENDING'));
    }
    return data;
  }, [rows, filters]);

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-[color:var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar conta ou centro de custo"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          className="w-full md:w-80"
        />
        <Select value={filters.costCenterId} onValueChange={(value) => onFiltersChange({ ...filters, costCenterId: value })}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Centro de custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos centros</SelectItem>
            {costCenters.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filters.onlyPending ? 'default' : 'outline'}
          onClick={() => onFiltersChange({ ...filters, onlyPending: !filters.onlyPending })}
        >
          Mostrar apenas pendentes
        </Button>
        <Select value={filters.orderBy} onValueChange={(value) => onFiltersChange({ ...filters, orderBy: value })}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Maior Total Cenário</SelectItem>
            <SelectItem value="var">Maior Variação</SelectItem>
            <SelectItem value="pending">Pendentes primeiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface-3)] text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Conta</th>
              <th className="px-4 py-3 text-left">Centro de custo</th>
              <th className="px-4 py-3 text-right">Realizado Ano Ant.</th>
              <th className="px-4 py-3 text-right">Cenário</th>
              <th className="px-4 py-3 text-right">Var.</th>
              <th className="px-4 py-3 text-left">Progresso</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const progress = row.itemsCount === 0 ? 0 : row.filledItemsCount / row.itemsCount;
              const deltaPct = row.varPct ?? calcDeltaPct(row.scenarioTotal, row.actualPrevYearTotal);
              return (
                <tr key={`${row.accountCode}-${row.costCenterId ?? 'none'}`} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">{row.accountCode} - {row.accountName}</td>
                  <td className="px-4 py-3">{row.costCenterName ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.actualPrevYearTotal)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.scenarioTotal)}</td>
                  <td className={`px-4 py-3 text-right ${deltaPct !== null && deltaPct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {deltaPct === null ? '—' : `${deltaPct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-border/60">
                        <div className="h-2 rounded-full bg-[color:var(--accent-2)]" style={{ width: `${progress * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Itens: {row.itemsCount} | Preenchidos: {row.filledItemsCount}
                      </span>
                      {row.status === 'PENDING' && (
                        <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => onOpen(row)}>Abrir</Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
