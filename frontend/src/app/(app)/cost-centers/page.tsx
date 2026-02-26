'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Building2,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  flexRender,
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { CostCenter, User } from '@/lib/types';
import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

type DialogMode = 'create' | 'edit' | 'duplicate' | null;
type OwnerFilter = 'all' | 'with' | 'without';

const PAGE_SIZES = [10, 20, 50] as const;

const formSchema = z.object({
  code: z.string().min(1, 'Codigo obrigatorio'),
  name: z.string().min(1, 'Nome obrigatorio'),
  ownerCoordinatorId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CostCenterRow {
  id: string;
  code: string;
  name: string;
  ownerId?: string | null;
  ownerName: string;
  ownerRole?: string | null;
  active: boolean;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function buildDuplicateCode(code: string, existingCodes: Set<string>) {
  const base = `${code}-copy`;
  let candidate = base;
  let counter = 2;
  while (existingCodes.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

const ownerFilterFn: FilterFn<CostCenterRow> = (row, columnId, filterValue) => {
  if (filterValue === 'with') {
    return Boolean(row.getValue(columnId));
  }
  if (filterValue === 'without') {
    return !row.getValue(columnId);
  }
  return true;
};

const globalFilterFn: FilterFn<CostCenterRow> = (row, _columnId, filterValue) => {
  const query = String(filterValue ?? '').trim().toLowerCase();
  if (!query) return true;
  return row.original.code.toLowerCase().includes(query) || row.original.name.toLowerCase().includes(query);
};

export default function CostCentersPage() {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'code', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', name: '', ownerCoordinatorId: null },
  });

  const { data: costCenters = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: () => backend.listCostCenters(apiFetch),
  });

  const { data: usersResponse, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users'),
  });
  const users = Array.isArray(usersResponse) ? usersResponse : [];

  const ownersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const ownerOptions = useMemo(
    () => users.filter((user) => user.role === 'COORDINATOR' && user.active),
    [users],
  );

  const activeCenters = useMemo(() => costCenters.filter((cc) => cc.active !== false), [costCenters]);

  const stats = useMemo(() => {
    const total = activeCenters.length;
    const withoutOwner = activeCenters.filter((cc) => !cc.ownerCoordinatorId).length;
    const ownerIds = new Set(
      activeCenters
        .map((cc) => cc.ownerCoordinatorId)
        .filter((id): id is string => Boolean(id)),
    );
    const activeOwners = Array.from(ownerIds).filter((id) => ownersById.get(id)?.active).length;
    return { total, withoutOwner, activeOwners };
  }, [activeCenters, ownersById]);

  const rows = useMemo<CostCenterRow[]>(() => {
    return activeCenters.map((cc) => {
      const owner = cc.ownerCoordinatorId ? ownersById.get(cc.ownerCoordinatorId) : null;
      return {
        id: cc.id,
        code: cc.code,
        name: cc.name,
        ownerId: cc.ownerCoordinatorId,
        ownerName: owner?.name ?? 'Sem owner',
        ownerRole: owner?.role ?? null,
        active: cc.active,
      };
    });
  }, [activeCenters, ownersById]);

  useEffect(() => {
    if (ownerFilter === 'all') {
      setColumnFilters([]);
    } else {
      setColumnFilters([{ id: 'ownerId', value: ownerFilter }]);
    }
  }, [ownerFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter, ownerFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<CostCenter>) => backend.createCostCenter(apiFetch, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Centro criado com sucesso');
    },
    onError: () => {
      toast.error('Nao foi possivel criar o centro');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CostCenter> }) => backend.updateCostCenter(apiFetch, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Centro atualizado');
    },
    onError: () => {
      toast.error('Nao foi possivel atualizar o centro');
    },
  });

  const setOwnerMutation = useMutation({
    mutationFn: ({ id, ownerCoordinatorId }: { id: string; ownerCoordinatorId: string | null }) =>
      backend.setCostCenterOwner(apiFetch, id, ownerCoordinatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Owner atualizado');
    },
    onError: () => {
      toast.error('Nao foi possivel atualizar o owner');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => backend.updateCostCenter(apiFetch, id, { active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Centro removido');
    },
    onError: () => {
      toast.error('Nao foi possivel remover o centro');
    },
  });

  const openDialog = useCallback((mode: DialogMode, center?: CostCenterRow | null) => {
    setDialogMode(mode);
    setDialogOpen(true);
    setOwnerSearch('');
    if (mode === 'create') {
      form.reset({ code: '', name: '', ownerCoordinatorId: null });
      return;
    }
    if (center) {
      setSelectedId(center.id);
      form.reset({
        code: mode === 'duplicate' ? buildDuplicateCode(center.code, new Set(rows.map((cc) => cc.code))) : center.code,
        name: center.name,
        ownerCoordinatorId: center.ownerId ?? null,
      });
    }
  }, [form, rows]);

  const columns = useMemo<ColumnDef<CostCenterRow>[]>(() => {
    return [
      {
        accessorKey: 'code',
        header: 'Codigo',
        cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => <span>{row.original.name}</span>,
      },
      {
        id: 'ownerId',
        accessorFn: (row) => row.ownerId ?? '',
        header: 'Owner',
        filterFn: ownerFilterFn,
        cell: ({ row }) => {
          const ownerName = row.original.ownerName;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-border/60">
                <AvatarFallback>{getInitials(ownerName)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium text-foreground">{ownerName}</div>
                <div className="text-xs text-muted-foreground">{row.original.ownerRole ?? 'Sem responsavel'}</div>
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.ownerId ? (
            <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              Atribuido
            </Badge>
          ) : (
            <Badge variant="secondary" className="border border-border/60 bg-[color:var(--surface-3)] text-muted-foreground">
              Sem owner
            </Badge>
          ),
        enableSorting: false,
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
                <DropdownMenuItem onClick={() => openDialog('edit', row.original)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog('duplicate', row.original)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedId(row.original.id);
                    setConfirmDeleteOpen(true);
                  }}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        enableSorting: false,
      },
    ];
  }, [openDialog]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnFilters, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const selectedCenter = activeCenters.find((center) => center.id === selectedId) ?? null;
  const selectedRow = rows.find((center) => center.id === selectedId) ?? null;

  const onSubmit = async (values: FormValues) => {
    try {
      if (dialogMode === 'create' || dialogMode === 'duplicate') {
        await createMutation.mutateAsync({
          code: values.code.trim(),
          name: values.name.trim(),
          ownerCoordinatorId: values.ownerCoordinatorId ?? null,
          active: true,
        });
      } else if (dialogMode === 'edit' && selectedCenter) {
        if (values.name.trim() !== selectedCenter.name) {
          await updateMutation.mutateAsync({ id: selectedCenter.id, data: { name: values.name.trim() } });
        }
        if (selectedRow && values.ownerCoordinatorId !== selectedRow.ownerId) {
          await setOwnerMutation.mutateAsync({ id: selectedCenter.id, ownerCoordinatorId: values.ownerCoordinatorId ?? null });
        }
      }
      setDialogOpen(false);
    } catch {
      return;
    }
  };

  const handleDelete = async () => {
    if (!selectedCenter) return;
    await deactivateMutation.mutateAsync({ id: selectedCenter.id });
    setConfirmDeleteOpen(false);
  };

  const ownerSearchValue = ownerSearch.trim().toLowerCase();
  const ownerList = ownerOptions.filter((owner) => owner.name.toLowerCase().includes(ownerSearchValue));

  return (
    <RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Centros de Custo"
          description="Defina ownership, setores e governanca dos centros."
          breadcrumbs={[
            { label: 'Cadastros', href: '/dashboard' },
            { label: 'Centros de custo' },
          ]}
          actions={
            <>
              <Button variant="outline" className="border-border/60" onClick={() => toast('Exportacao em breve')}>
                Exportar
              </Button>
              <Button
                className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                onClick={() => openDialog('create')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar centro
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`stat-${index}`} className="h-24 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard label="Total de centros" value={stats.total} helper="Centros ativos cadastrados" icon={<Building2 className="h-5 w-5" />} />
              <StatCard label="Sem owner" value={stats.withoutOwner} helper="Pendente de atribuicao" icon={<Users className="h-5 w-5" />} />
              <StatCard label="Owners ativos" value={stats.activeOwners} helper="Unicos com responsavel" icon={<UserCheck className="h-5 w-5" />} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-2)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar por codigo ou nome"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtro
            </div>
            <Select value={ownerFilter} onValueChange={(value: OwnerFilter) => setOwnerFilter(value)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with">Com owner</SelectItem>
                <SelectItem value="without">Sem owner</SelectItem>
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
                title="Nao foi possivel carregar os centros"
                description="Verifique sua conexao ou tente novamente."
                action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
              />
            </div>
          ) : activeCenters.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Sem centros cadastrados"
                description="Crie o primeiro centro para comecar o planejamento."
                action={<Button onClick={() => openDialog('create')}>Criar primeiro centro</Button>}
              />
            </div>
          ) : filteredCount === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nenhum centro encontrado"
                description="Tente ajustar o termo de busca ou os filtros."
                action={
                  <Button variant="outline" onClick={() => { setGlobalFilter(''); setOwnerFilter('all'); }}>
                    Limpar filtros
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-3 text-sm text-muted-foreground">
                <span>{filteredCount} centros encontrados</span>
                <div className="flex items-center gap-3">
                  <span>Ordenar por</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.getColumn('code')?.toggleSorting()}
                    className={cn(table.getState().sorting[0]?.id === 'code' && 'text-[color:var(--accent-2)]')}
                  >
                    Codigo
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.getColumn('name')?.toggleSorting()}
                    className={cn(table.getState().sorting[0]?.id === 'name' && 'text-[color:var(--accent-2)]')}
                  >
                    Nome
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[color:var(--surface-2)]">
                    {table.getHeaderGroups().map((headerGroup) =>
                      headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={cn(header.id === 'actions' && 'text-right')}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => setSelectedId(row.original.id)}
                      className={cn(
                        'cursor-pointer transition hover:bg-[color:var(--surface-2)]',
                        selectedId === row.original.id && 'accent-divider bg-[color:var(--surface-2)]',
                      )}
                    >
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
                  Mostrando {table.getRowModel().rows.length} de {filteredCount} centros
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Linhas por pagina</span>
                  <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'edit' ? 'Editar centro' : dialogMode === 'duplicate' ? 'Duplicar centro' : 'Novo centro'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codigo</FormLabel>
                      <FormControl>
                        <Input placeholder="CC-LOG" disabled={dialogMode === 'edit'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Logistica" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownerCoordinatorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner</FormLabel>
                      <Input
                        value={ownerSearch}
                        onChange={(event) => setOwnerSearch(event.target.value)}
                        placeholder="Buscar owner"
                        className="h-9"
                        disabled={usersLoading}
                      />
                      <Select
                        value={field.value ?? 'none'}
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione um owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sem owner</SelectItem>
                          {ownerList.map((owner) => (
                            <SelectItem key={owner.id} value={owner.id}>
                              {owner.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                    disabled={createMutation.isPending || updateMutation.isPending || setOwnerMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending || setOwnerMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir centro</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Voce tem certeza que deseja excluir este centro? Esta acao pode ser revertida reativando o centro.</p>
              {selectedCenter && (
                <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3 text-foreground">
                  <div className="text-xs uppercase text-muted-foreground">Centro selecionado</div>
                  <div className="font-medium">{selectedCenter.code}</div>
                  <div className="text-sm">{selectedCenter.name}</div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deactivateMutation.isPending}>
                {deactivateMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

