'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Budget, BudgetImport } from '@/lib/types';
import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { DataTable } from '@/components/shared/data-table';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Check, Copy, Download, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';

const budgetSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  year: z.coerce.number().int().min(2000, 'Ano invalido').max(2100, 'Ano invalido'),
  kind: z.enum(['BUDGET', 'ACTUAL']).optional(),
  status: z.enum(['DRAFT', 'READY', 'PROCESSING', 'ERROR', 'ARCHIVED']),
  notes: z.string().optional(),
});

type BudgetFormValues = z.output<typeof budgetSchema>;
type BudgetFormInputValues = z.input<typeof budgetSchema>;

type DialogMode = 'create' | 'edit' | 'view' | 'import' | 'delete' | null;

function formatStatus(status: Budget['status']) {
  switch (status) {
    case 'READY':
      return 'Pronto';
    case 'PROCESSING':
      return 'Processando';
    case 'ERROR':
      return 'Erro';
    case 'ARCHIVED':
      return 'Arquivado';
    default:
      return 'Rascunho';
  }
}

function statusBadgeClass(status: Budget['status']) {
  if (status === 'READY') return 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]';
  if (status === 'PROCESSING') return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  if (status === 'ERROR') return 'border-rose-400/40 bg-rose-400/10 text-rose-300';
  if (status === 'ARCHIVED') return 'border-border/60 bg-[color:var(--surface-3)] text-muted-foreground';
  return 'border-border/60 bg-[color:var(--surface-3)] text-muted-foreground';
}

function formatLabel(budget: Budget, yearCounts: Map<number, number>) {
  const count = yearCounts.get(budget.year) ?? 0;
  const suffix = count > 1 ? ` (v${budget.version})` : '';
  return `${budget.name} (${budget.year})${suffix}`;
}

export default function BudgetsPage() {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const form = useForm<BudgetFormInputValues, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '',
      year: new Date().getFullYear(),
      kind: 'BUDGET',
      status: 'DRAFT',
      notes: '',
    },
  });

  const { data: budgets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => backend.listBudgets(apiFetch),
  });

  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>();
    budgets.forEach((budget) => {
      counts.set(budget.year, (counts.get(budget.year) ?? 0) + 1);
    });
    return counts;
  }, [budgets]);

  const { data: imports = [] } = useQuery<BudgetImport[]>({
    queryKey: ['budget-imports', selectedBudget?.id],
    queryFn: () => backend.listBudgetImports(apiFetch, selectedBudget!.id),
    enabled: dialogMode === 'view' && Boolean(selectedBudget),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Budget>) => backend.createBudget(apiFetch, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orcamento criado');
    },
    onError: () => toast.error('Nao foi possivel criar o orcamento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) => backend.updateBudget(apiFetch, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orcamento atualizado');
    },
    onError: () => toast.error('Nao foi possivel atualizar o orcamento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backend.deleteBudget(apiFetch, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orcamento removido');
    },
    onError: () => toast.error('Nao foi possivel remover o orcamento'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => backend.duplicateBudget(apiFetch, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orcamento duplicado');
    },
    onError: () => toast.error('Nao foi possivel duplicar o orcamento'),
  });

  const setActiveMutation = useMutation({
    mutationFn: (id: string) => backend.setActiveBudget(apiFetch, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orcamento ativado');
    },
    onError: () => toast.error('Nao foi possivel ativar o orcamento'),
  });

  const importMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => backend.importBudget(apiFetch, id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Importacao iniciada');
    },
    onError: () => toast.error('Nao foi possivel importar o arquivo'),
  });

  const openDialog = useCallback(
    (mode: DialogMode, budget?: Budget | null) => {
      setDialogMode(mode);
      setSelectedBudget(budget ?? null);
      if (mode === 'create') {
        form.reset({
          name: '',
          year: new Date().getFullYear(),
          kind: 'BUDGET',
          status: 'DRAFT',
          notes: '',
        });
      }
      if (mode === 'edit' && budget) {
        form.reset({
          name: budget.name,
          year: budget.year,
          kind: budget.kind,
          status: budget.status,
          notes: budget.notes ?? '',
        });
      }
    },
    [form],
  );

  const handleSubmit = async (values: BudgetFormValues) => {
    try {
      if (dialogMode === 'create') {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          year: values.year,
          kind: values.kind,
          notes: values.notes?.trim() || null,
        });
      }
      if (dialogMode === 'edit' && selectedBudget) {
        await updateMutation.mutateAsync({
          id: selectedBudget.id,
          data: {
            name: values.name.trim(),
            year: values.year,
            kind: values.kind,
            status: values.status,
            notes: values.notes?.trim() || null,
          },
        });
      }
      setDialogMode(null);
    } catch {
      return;
    }
  };

  const handleDelete = async () => {
    if (!selectedBudget) return;
    await deleteMutation.mutateAsync(selectedBudget.id);
    setDialogMode(null);
  };

  const handleImport = async () => {
    if (!selectedBudget || !importFile) return;
    await importMutation.mutateAsync({ id: selectedBudget.id, file: importFile });
    setImportFile(null);
    setDialogMode(null);
  };

  return (
    <RoleGuard roles={['ADMIN']}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Orcamentos"
          description="Gerencie orcamentos, importacoes e ativacao por ano."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const active = budgets.find((budget) => budget.isActive) ?? budgets[0] ?? null;
                  openDialog('import', active);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Importar planilha
              </Button>
              <Button
                className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                onClick={() => openDialog('create')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo orcamento
              </Button>
            </>
          }
        />

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
                title="Nao foi possivel carregar os orcamentos"
                description="Verifique sua conexao ou tente novamente."
                action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
              />
            </div>
          ) : budgets.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Sem orcamentos cadastrados"
                description="Crie o primeiro orcamento para comecar."
                action={<Button onClick={() => openDialog('create')}>Criar primeiro orcamento</Button>}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[color:var(--surface-2)]">
                  <TableHead>Nome</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget.id} className="hover:bg-[color:var(--surface-2)]">
                    <TableCell className="font-medium">{formatLabel(budget, yearCounts)}</TableCell>
                    <TableCell>{budget.year}</TableCell>
                    <TableCell>{budget.kind === 'ACTUAL' ? 'Realizado' : 'Orcado'}</TableCell>
                    <TableCell>v{budget.version}</TableCell>
                    <TableCell>
                      <Badge className={`border ${statusBadgeClass(budget.status)}`}>{formatStatus(budget.status)}</Badge>
                    </TableCell>
                    <TableCell>{new Date(budget.updatedAt).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      {budget.isActive ? (
                        <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                          ATIVO
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog('view', budget)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDialog('edit', budget)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDialog('import', budget)}>
                            <Download className="mr-2 h-4 w-4" />
                            Importar/Substituir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(budget.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setActiveMutation.mutate(budget.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Definir como ativo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDialog('delete', budget)}
                            className="text-rose-500 focus:text-rose-500"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>

        <Dialog open={dialogMode === 'create' || dialogMode === 'edit'} onOpenChange={(open) => !open && setDialogMode(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'edit' ? 'Editar orcamento' : 'Novo orcamento'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Orcamento 2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            name={field.name}
                            ref={field.ref}
                            value={typeof field.value === 'number' ? field.value : Number(field.value ?? new Date().getFullYear())}
                            onBlur={field.onBlur}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <FormControl>
                          <Input value={field.value === 'ACTUAL' ? 'Realizado' : 'Orcado'} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {dialogMode === 'edit' && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="DRAFT">Rascunho</SelectItem>
                            <SelectItem value="READY">Pronto</SelectItem>
                            <SelectItem value="PROCESSING">Processando</SelectItem>
                            <SelectItem value="ERROR">Erro</SelectItem>
                            <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Observacoes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogMode(null)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogMode === 'import'} onOpenChange={(open) => !open && setDialogMode(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar orcamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Selecione o orcamento e envie o arquivo (.xlsx ou .csv).</p>
              <Select
                value={selectedBudget?.id ?? ''}
                onValueChange={(value) => {
                  const target = budgets.find((budget) => budget.id === value) ?? null;
                  setSelectedBudget(target);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o orcamento" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.name} ({budget.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || !selectedBudget || importMutation.isPending}
                className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
              >
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogMode === 'view'} onOpenChange={(open) => !open && setDialogMode(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Detalhes do orcamento</DialogTitle>
            </DialogHeader>
            {selectedBudget && (
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3">
                  <div className="text-xs uppercase text-muted-foreground">Resumo</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{selectedBudget.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedBudget.year} â€¢ {selectedBudget.kind === 'ACTUAL' ? 'Realizado' : 'Orcado'} â€¢ v{selectedBudget.version}
                  </div>
                  {selectedBudget.notes && <div className="mt-2 text-xs">{selectedBudget.notes}</div>}
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Historico de imports</div>
                  {imports.length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">Nenhum import registrado.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {imports.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                          <div>
                            <div className="text-sm text-foreground">v{item.version}</div>
                            <div className="text-xs text-muted-foreground">{item.fileName}</div>
                          </div>
                          <Badge className={`border ${statusBadgeClass(item.status)}`}>{formatStatus(item.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogMode === 'delete'} onOpenChange={(open) => !open && setDialogMode(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remover orcamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Voce tem certeza que deseja remover este orcamento? Esta acao nao pode ser desfeita.</p>
              {selectedBudget && (
                <div className="rounded-xl border border-border/60 bg-[color:var(--surface-2)] p-3 text-foreground">
                  <div className="text-xs uppercase text-muted-foreground">Orcamento selecionado</div>
                  <div className="font-medium">{selectedBudget.name}</div>
                  <div className="text-sm">{selectedBudget.year}</div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

