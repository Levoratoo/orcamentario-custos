'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetGrid = BudgetGrid;
const react_1 = require("react");
const react_query_1 = require("@tanstack/react-query");
const react_table_1 = require("@tanstack/react-table");
const backend_1 = require("@/services/backend");
const use_api_client_1 = require("@/hooks/use-api-client");
const formatters_1 = require("@/lib/formatters");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const table_1 = require("@/components/ui/table");
const card_1 = require("@/components/ui/card");
const lucide_react_1 = require("lucide-react");
const budget_line_dialog_1 = require("./budget-line-dialog");
const import_csv_dialog_1 = require("./import-csv-dialog");
function BudgetGrid({ scenarioId, costCenters, accounts, readOnly = false }) {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const [search, setSearch] = (0, react_1.useState)('');
    const [expanded, setExpanded] = (0, react_1.useState)({});
    const { data: budgetLinesResponse } = (0, react_query_1.useQuery)({
        queryKey: ['budget-lines', scenarioId],
        queryFn: () => backend_1.backend.listBudgetLines(apiFetch, { scenarioId, page: 1, pageSize: 500 }),
        enabled: Boolean(scenarioId),
    });
    const budgetLines = (0, react_1.useMemo)(() => {
        const raw = budgetLinesResponse?.items || [];
        if (!search)
            return raw;
        return raw.filter((line) => line.description.toLowerCase().includes(search.toLowerCase()));
    }, [budgetLinesResponse, search]);
    const updateMutation = (0, react_query_1.useMutation)({
        mutationFn: (data) => backend_1.backend.updateBudgetLine(apiFetch, data.id, { monthlyValues: data.monthlyValues }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-lines', scenarioId] }),
    });
    const grouped = (0, react_1.useMemo)(() => {
        return costCenters.map((cc) => ({
            costCenter: cc,
            lines: budgetLines.filter((line) => line.costCenterId === cc.id),
        })).filter((group) => group.lines.length > 0);
    }, [costCenters, budgetLines]);
    const exportCsv = () => {
        const header = ['scenarioId', 'costCenterId', 'accountId', 'description', 'driverType', 'assumptions', ...formatters_1.monthKeys];
        const rows = budgetLines.map((line) => {
            const values = (0, formatters_1.normalizeMonthly)(line.monthlyValues);
            return [
                line.scenarioId,
                line.costCenterId,
                line.accountId,
                line.description,
                line.driverType,
                line.assumptions || '',
                ...formatters_1.monthKeys.map((key) => values[key]),
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
    const columns = (0, react_1.useMemo)(() => {
        return [
            {
                header: 'Conta',
                accessorKey: 'accountId',
                cell: ({ row }) => {
                    const account = accounts.find((acc) => acc.id === row.original.accountId);
                    return (<div>
              <div className="text-sm font-medium">{account?.code || '-'}</div>
              <div className="text-xs text-muted-foreground">{account?.name}</div>
            </div>);
                },
            },
            {
                header: 'Descricao',
                accessorKey: 'description',
                cell: ({ row }) => <div className="text-sm">{row.original.description}</div>,
            },
            ...formatters_1.monthKeys.map((key) => ({
                header: key,
                accessorKey: `monthlyValues.${key}`,
                cell: ({ row }) => {
                    const values = (0, formatters_1.normalizeMonthly)(row.original.monthlyValues);
                    return (<input_1.Input className="h-8 w-20 text-right" defaultValue={values[key]} readOnly={readOnly} onBlur={(event) => {
                            if (readOnly)
                                return;
                            const next = { ...values, [key]: event.target.value || '0.00' };
                            updateMutation.mutate({ id: row.original.id, monthlyValues: next });
                        }}/>);
                },
            })),
            {
                header: 'Total',
                id: 'total',
                cell: ({ row }) => {
                    const total = (0, formatters_1.sumMonthlyValues)(row.original.monthlyValues);
                    return <div className="text-right text-sm font-semibold">{(0, formatters_1.formatCurrencyBRL)(total)}</div>;
                },
            },
        ];
    }, [accounts, updateMutation]);
    return (<div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input_1.Input placeholder="Buscar descricao" className="w-64" value={search} onChange={(event) => setSearch(event.target.value)}/>
        {!readOnly && (<>
            <budget_line_dialog_1.BudgetLineDialog scenarioId={scenarioId} costCenters={costCenters} accounts={accounts}/>
            <import_csv_dialog_1.ImportCsvDialog scenarioId={scenarioId}/>
          </>)}
        <button_1.Button variant="outline" size="sm" onClick={exportCsv}>
          Exportar CSV
        </button_1.Button>
      </div>

      {grouped.length === 0 && (<card_1.Card className="rounded-2xl p-6 text-center text-muted-foreground">
          Nenhuma linha cadastrada para este cenario.
        </card_1.Card>)}

      {grouped.map((group) => {
            const table = (0, react_table_1.useReactTable)({
                data: group.lines,
                columns,
                getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
            });
            const totalByMonth = formatters_1.monthKeys.reduce((acc, key) => {
                acc[key] = group.lines.reduce((sum, line) => sum + (0, formatters_1.parseDecimal)(line.monthlyValues[key] || '0'), 0);
                return acc;
            }, {});
            const totalAnnual = Object.values(totalByMonth).reduce((sum, val) => sum + val, 0);
            const isOpen = expanded[group.costCenter.id] ?? true;
            return (<card_1.Card key={group.costCenter.id} className="rounded-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setExpanded((prev) => ({ ...prev, [group.costCenter.id]: !isOpen }))}>
                {isOpen ? <lucide_react_1.ChevronDown className="h-4 w-4"/> : <lucide_react_1.ChevronRight className="h-4 w-4"/>}
                {group.costCenter.code} - {group.costCenter.name}
              </button>
              <div className="text-sm font-medium">{(0, formatters_1.formatCurrencyBRL)(totalAnnual)}</div>
            </div>
            {isOpen && (<div className="overflow-x-auto">
                <table_1.Table>
                  <table_1.TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (<table_1.TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (<table_1.TableHead key={header.id} className="whitespace-nowrap">
                            {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                          </table_1.TableHead>))}
                      </table_1.TableRow>))}
                  </table_1.TableHeader>
                  <table_1.TableBody>
                    {table.getRowModel().rows.map((row) => (<table_1.TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (<table_1.TableCell key={cell.id}>
                            {(0, react_table_1.flexRender)(cell.column.columnDef.cell, cell.getContext())}
                          </table_1.TableCell>))}
                      </table_1.TableRow>))}
                    <table_1.TableRow className="bg-muted/40">
                      <table_1.TableCell colSpan={2} className="text-sm font-semibold">Subtotal</table_1.TableCell>
                      {formatters_1.monthKeys.map((key) => (<table_1.TableCell key={key} className="text-right text-sm font-medium">
                          {(0, formatters_1.formatCurrencyBRL)(totalByMonth[key] || 0)}
                        </table_1.TableCell>))}
                      <table_1.TableCell className="text-right text-sm font-semibold">{(0, formatters_1.formatCurrencyBRL)(totalAnnual)}</table_1.TableCell>
                    </table_1.TableRow>
                  </table_1.TableBody>
                </table_1.Table>
              </div>)}
          </card_1.Card>);
        })}
    </div>);
}
//# sourceMappingURL=budget-grid.js.map