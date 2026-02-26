'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, Row, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { BudgetLine, CostCenter, Account } from '@/lib/types';
import { monthKeys, normalizeMonthly, parseDecimal, sumMonthlyValues, formatCurrencyBRL } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BudgetLineDialog } from './budget-line-dialog';
import { ImportCsvDialog } from './import-csv-dialog';

interface BudgetGridProps {
  scenarioId: string;
  costCenters: CostCenter[];
  accounts: Account[];
  readOnly?: boolean;
}

export function BudgetGrid({ scenarioId, costCenters, accounts, readOnly = false }: BudgetGridProps) {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: budgetLinesResponse } = useQuery({
    queryKey: ['budget-lines', scenarioId],
    queryFn: () => backend.listBudgetLines(apiFetch, { scenarioId, page: 1, pageSize: 500 }),
    enabled: Boolean(scenarioId),
  });

  const budgetLines = useMemo(() => {
    const raw = budgetLinesResponse?.items || [];
    if (!search) return raw;
    return raw.filter((line) => line.description.toLowerCase().includes(search.toLowerCase()));
  }, [budgetLinesResponse, search]);

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; monthlyValues: Record<string, string> }) =>
      backend.updateBudgetLine(apiFetch, data.id, { monthlyValues: data.monthlyValues }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-lines', scenarioId] }),
  });

  const grouped = useMemo(() => {
    return costCenters.map((cc) => ({
      costCenter: cc,
      lines: budgetLines.filter((line) => line.costCenterId === cc.id),
    })).filter((group) => group.lines.length > 0);
  }, [costCenters, budgetLines]);

  const exportCsv = () => {
    const header = ['scenarioId', 'costCenterId', 'accountId', 'description', 'driverType', 'assumptions', ...monthKeys];
    const rows = budgetLines.map((line) => {
      const values = normalizeMonthly(line.monthlyValues);
      return [
        line.scenarioId,
        line.costCenterId,
        line.accountId,
        line.description,
        line.driverType,
        line.assumptions || '',
        ...monthKeys.map((key) => values[key]),
      ];
    });
    const csv = [header.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/\"/g, '\"\"')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-${scenarioId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<BudgetLine>[]>(() => {
    return [
      {
        header: 'Conta',
        accessorKey: 'accountId',
        cell: ({ row }: { row: Row<BudgetLine> }) => {
          const account = accounts.find((acc) => acc.id === row.original.accountId);
          return (
            <div>
              <div className="text-sm font-medium">{account?.code || '-'}</div>
              <div className="text-xs text-muted-foreground">{account?.name}</div>
            </div>
          );
        },
      },
      {
        header: 'Descricao',
        accessorKey: 'description',
        cell: ({ row }: { row: Row<BudgetLine> }) => <div className="text-sm">{row.original.description}</div>,
      },
      ...monthKeys.map((key) => ({
        header: key,
        accessorKey: `monthlyValues.${key}`,
        cell: ({ row }: { row: Row<BudgetLine> }) => {
          const values = normalizeMonthly(row.original.monthlyValues);
          return (
            <Input
              className="h-8 w-20 text-right"
              defaultValue={values[key]}
              readOnly={readOnly}
              onBlur={(event) => {
                if (readOnly) return;
                const next = { ...values, [key]: event.target.value || '0.00' };
                updateMutation.mutate({ id: row.original.id, monthlyValues: next });
              }}
            />
          );
        },
      })),
      {
        header: 'Total',
        id: 'total',
        cell: ({ row }: { row: Row<BudgetLine> }) => {
          const total = sumMonthlyValues(row.original.monthlyValues);
          return <div className="text-right text-sm font-semibold">{formatCurrencyBRL(total)}</div>;
        },
      },
    ];
  }, [accounts, updateMutation]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar descricao"
          className="w-64"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {!readOnly && (
          <>
            <BudgetLineDialog scenarioId={scenarioId} costCenters={costCenters} accounts={accounts} />
            <ImportCsvDialog scenarioId={scenarioId} />
          </>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv}>
          Exportar CSV
        </Button>
      </div>

      {grouped.length === 0 && (
        <Card className="rounded-2xl p-6 text-center text-muted-foreground">
          Nenhuma linha cadastrada para este cenario.
        </Card>
      )}

      {grouped.map((group) => {
        const table = useReactTable({
          data: group.lines,
          columns,
          getCoreRowModel: getCoreRowModel(),
        });

        const totalByMonth = monthKeys.reduce((acc, key) => {
          acc[key] = group.lines.reduce((sum, line) => sum + parseDecimal(line.monthlyValues[key] || '0'), 0);
          return acc;
        }, {} as Record<string, number>);

        const totalAnnual = Object.values(totalByMonth).reduce((sum, val) => sum + val, 0);

        const isOpen = expanded[group.costCenter.id] ?? true;

        return (
          <Card key={group.costCenter.id} className="rounded-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <button
                className="flex items-center gap-2 text-sm font-semibold"
                onClick={() => setExpanded((prev) => ({ ...prev, [group.costCenter.id]: !isOpen }))}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {group.costCenter.code} - {group.costCenter.name}
              </button>
              <div className="text-sm font-medium">{formatCurrencyBRL(totalAnnual)}</div>
            </div>
            {isOpen && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} className="whitespace-nowrap">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={2} className="text-sm font-semibold">Subtotal</TableCell>
                      {monthKeys.map((key) => (
                        <TableCell key={key} className="text-right text-sm font-medium">
                          {formatCurrencyBRL(totalByMonth[key] || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-sm font-semibold">{formatCurrencyBRL(totalAnnual)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
