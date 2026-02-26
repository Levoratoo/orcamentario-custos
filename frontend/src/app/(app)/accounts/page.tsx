'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Download,
  Filter,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ColumnDef,
  ExpandedState,
  SortingState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { AccountPlan } from '@/lib/types';
import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/errors';

type AccountTypeFilter = 'all' | 'T' | 'A';

const PAGE_SIZES = [10, 20, 50] as const;

const editSchema = z.object({
  description: z.string().min(1, 'Descricao obrigatoria'),
});

type EditFormValues = z.infer<typeof editSchema>;

const importSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo XLSX obrigatorio' }),
});

type ImportFormValues = z.infer<typeof importSchema>;

interface TreeRow extends AccountPlan {
  children?: TreeRow[];
}

export default function AccountsPage() {
  const { apiFetch } = useApiClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountTypeFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'classification', desc: false }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<AccountPlan | null>(null);

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { description: '' },
  });

  const importForm = useForm<ImportFormValues>({
    resolver: zodResolver(importSchema),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['account-plans', search, typeFilter],
    queryFn: () =>
      backend.listAccountPlans(apiFetch, {
        search: search || undefined,
        tipo: typeFilter === 'all' ? undefined : typeFilter,
        tree: true,
      }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => backend.importAccountPlans(apiFetch, file),
    onSuccess: (result) => {
      toast.success(`Importado: ${result.inserted} novos, ${result.updated} atualizados`);
      if (result.errors?.length) {
        toast.error(`Erros: ${result.errors.length}`);
      }
      refetch();
      setImportOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Falha ao importar')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      backend.updateAccountPlan(apiFetch, id, { description }),
    onSuccess: () => {
      toast.success('Descricao atualizada');
      refetch();
      setEditOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Falha ao atualizar')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => backend.deactivateAccountPlan(apiFetch, id),
    onSuccess: () => {
      toast.success('Conta desativada');
      refetch();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Falha ao desativar')),
  });

  const rows = useMemo<TreeRow[]>(() => data?.items ?? [], [data]);

  const flatRows = useMemo(() => {
    const list: AccountPlan[] = [];
    const walk = (items: AccountPlan[]) => {
      items.forEach((item) => {
        list.push(item);
        if (item.children?.length) walk(item.children);
      });
    };
    walk(rows);
    return list;
  }, [rows]);

  const stats = useMemo(() => {
    const total = flatRows.length;
    const totalAnaliticas = flatRows.filter((row) => row.type === 'A').length;
    const totalTotalizadoras = flatRows.filter((row) => row.type === 'T').length;
    const levels = flatRows.map((row) => row.level);
    const min = levels.length ? Math.min(...levels) : 0;
    const max = levels.length ? Math.max(...levels) : 0;
    return { total, totalAnaliticas, totalTotalizadoras, min, max };
  }, [flatRows]);

  const openEdit = useCallback((row: AccountPlan) => {
    setSelected(row);
    editForm.reset({ description: row.description });
    setEditOpen(true);
  }, [editForm]);

  const columns = useMemo<ColumnDef<TreeRow>[]>(() => [
    {
      accessorKey: 'classification',
      header: 'Classificacao',
      cell: ({ row }) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 18}px` }}>
          {row.getCanExpand() ? (
            <button
              type="button"
              onClick={row.getToggleExpandedHandler()}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 transition hover:bg-[color:var(--surface-2)]"
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', row.getIsExpanded() && 'rotate-90')} />
            </button>
          ) : (
            <span className="h-7 w-7" />
          )}
          <span className="font-medium">{row.original.classification}</span>
        </div>
      ),
    },
    {
      accessorKey: 'code',
      header: 'Codigo',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Descricao',
      cell: ({ row }) => <span>{row.original.description}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
          {row.original.type}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => deactivateMutation.mutate(row.original.id)} className="text-red-500 focus:text-red-500">
                <Trash2 className="mr-2 h-4 w-4" />
                Desativar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [openEdit, deactivateMutation]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, expanded, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getSubRows: (row) => row.children ?? [],
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleImport = importForm.handleSubmit(({ file }) => {
    importMutation.mutate(file);
  });

  const handleEdit = editForm.handleSubmit(({ description }) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, description: description.trim() });
  });

  return (
    <RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Contas"
          description="Plano de contas com hierarquia totalizadora e analitica."
          actions={
            <>
              <Button variant="outline" className="border-border/60" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar XLSX
              </Button>
              <Button className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={`stat-${index}`} className="h-24 rounded-2xl" />)
          ) : (
            <>
              <StatCard label="Total de contas" value={stats.total} helper="Ativas no plano" />
              <StatCard label="Analiticas" value={stats.totalAnaliticas} helper="Tipo A" />
              <StatCard label="Totalizadoras" value={stats.totalTotalizadoras} helper="Tipo T" />
              <StatCard label="Niveis" value={`${stats.min}â€“${stats.max}`} helper="Profundidade" />
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-2)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por codigo, descricao ou classificacao"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtro
            </div>
            <Select value={typeFilter} onValueChange={(value: AccountTypeFilter) => setTypeFilter(value)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="T">Totalizadora</SelectItem>
                <SelectItem value="A">Analitica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable>
          {isLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-1/3 rounded-2xl" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={`row-${index}`} className="h-12 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ) : isError ? (
            <div className="p-6">
              <EmptyState
                title="Nao foi possivel carregar o plano"
                description="Verifique sua conexao ou tente novamente."
                action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
              />
            </div>
          ) : flatRows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nenhum plano importado"
                description="Importe o arquivo XLSX para preencher as contas."
                action={<Button onClick={() => setImportOpen(true)}>Importar plano</Button>}
              />
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nenhuma conta encontrada"
                description="Tente ajustar o termo de busca ou o filtro."
                action={<Button variant="outline" onClick={() => { setSearch(''); setTypeFilter('all'); }}>Limpar filtros</Button>}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-3 text-sm text-muted-foreground">
                <span>{table.getFilteredRowModel().rows.length} contas encontradas</span>
                <div className="flex items-center gap-2">
                  <span>Ordenar</span>
                  <Button variant="ghost" size="sm" onClick={() => table.getColumn('classification')?.toggleSorting()}>
                    Classificacao
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => table.getColumn('code')?.toggleSorting()}>
                    Codigo
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[color:var(--surface-2)]">
                    {table.getHeaderGroups().map((headerGroup) =>
                      headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={cn(header.id === 'actions' && 'text-right')}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-[color:var(--surface-2)]">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(cell.column.id === 'actions' && 'text-right')}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t border-border/60 px-6 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <div>
                  Mostrando {table.getRowModel().rows.length} de {table.getFilteredRowModel().rows.length} contas
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Linhas por pagina</span>
                  <Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
                    <SelectTrigger className="h-8 w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                    Anterior
                  </Button>
                  <span>
                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </span>
                  <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                    Proxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </DataTable>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar plano de contas</DialogTitle>
            </DialogHeader>
            <Form {...importForm}>
              <form onSubmit={handleImport} className="grid gap-4">
                <FormField
                  control={importForm.control}
                  name="file"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arquivo XLSX</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".xlsx"
                          onChange={(event) => field.onChange(event.target.files?.[0])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setImportOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? 'Importando...' : 'Importar'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar descricao</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={handleEdit} className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Conta</div>
                  <div className="font-medium">{selected?.classification}</div>
                  <div className="text-xs text-muted-foreground">{selected?.code}</div>
                </div>
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

