'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { Role, User } from '@/lib/types';
import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const userSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  username: z.string().min(3, 'Minimo 3 caracteres').regex(/^[a-zA-Z0-9._-]+$/, 'Use letras, numeros e ._-'),
  role: z.enum(['ADMIN', 'CONTROLLER', 'COORDINATOR']),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  password: z.string().min(6, 'Minimo 6 caracteres').optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

type UserFormMode = 'create' | 'edit';

function formatRole(role: Role) {
  if (role === 'COORDINATOR') return 'COORDENADOR';
  return role;
}

export default function AdminUsersPage() {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<UserFormMode>('create');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentUser, setAssignmentUser] = useState<User | null>(null);
  const [filterProacao, setFilterProacao] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => backend.listAdminUsers(apiFetch, 1, 200),
  });

  const users = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const target = search.toLowerCase();
    return items.filter((user) => user.name.toLowerCase().includes(target) || user.username.toLowerCase().includes(target));
  }, [data, search]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      username: '',
      role: 'COORDINATOR',
      active: true,
      mustChangePassword: true,
      password: '123456',
    },
  });

  const openCreate = () => {
    setFormMode('create');
    setSelectedUser(null);
    form.reset({
      name: '',
      username: '',
      role: 'COORDINATOR',
      active: true,
      mustChangePassword: true,
      password: '123456',
    });
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setFormMode('edit');
    setSelectedUser(user);
    form.reset({
      name: user.name,
      username: user.username,
      role: (user.role as 'ADMIN' | 'CONTROLLER' | 'COORDINATOR') ?? 'COORDINATOR',
      active: user.active,
      mustChangePassword: Boolean(user.mustChangePassword),
      password: '',
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (formMode === 'create') {
        return backend.createAdminUser(apiFetch, {
          name: values.name,
          username: values.username,
          role: values.role,
          active: values.active,
          mustChangePassword: values.mustChangePassword,
          password: values.password || '123456',
        });
      }
      if (!selectedUser) return null;
      return backend.updateAdminUser(apiFetch, selectedUser.id, {
        name: values.name,
        username: values.username,
        role: values.role as Role,
        active: values.active,
        mustChangePassword: values.mustChangePassword,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setFormOpen(false);
      toast.success('Salvo com sucesso');
    },
    onError: () => toast.error('Falha ao salvar usuario'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (user: User) => backend.updateAdminUser(apiFetch, user.id, { active: !user.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resetMutation = useMutation({
    mutationFn: () => backend.resetAdminUserPassword(apiFetch, selectedUser!.id, resetPassword || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setResetOpen(false);
      setResetPassword('');
      toast.success('Senha resetada');
    },
    onError: () => toast.error('Falha ao resetar senha'),
  });

  const assignmentsQuery = useQuery({
    queryKey: ['admin-user-assignments', assignmentUser?.id],
    enabled: Boolean(assignmentUser?.id),
    queryFn: () => backend.getAdminUserAssignments(apiFetch, assignmentUser!.id),
  });

  const assignmentData = assignmentsQuery.data;

  useEffect(() => {
    if (!assignmentData) return;
    setSelectedAccounts(new Set(assignmentData.assignedAccountIds));
  }, [assignmentData]);

  const proacoes = useMemo(() => {
    if (!assignmentData) return [];
    const map = new Map<string, string>();
    assignmentData.accounts.forEach((account) => {
      map.set(account.proacao.id, account.proacao.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [assignmentData]);

  const filteredAccounts = useMemo(() => {
    if (!assignmentData) return [];
    const target = filterQuery.trim().toLowerCase();
    return assignmentData.accounts.filter((account) => {
      const matchesProacao = filterProacao === 'all' || account.proacao.id === filterProacao;
      const matchesQuery =
        !target ||
        account.label.toLowerCase().includes(target) ||
        account.code.toLowerCase().includes(target) ||
        account.name.toLowerCase().includes(target);
      return matchesProacao && matchesQuery;
    });
  }, [assignmentData, filterQuery, filterProacao]);

  const openAssignments = (user: User) => {
    setAssignmentUser(user);
    setAssignmentOpen(true);
  };

  const handleAssignmentsOpenChange = (open: boolean) => {
    setAssignmentOpen(open);
    if (!open) {
      setAssignmentUser(null);
      setFilterProacao('all');
      setFilterQuery('');
      setSelectedAccounts(new Set());
    }
  };

  const syncAssignmentsMutation = useMutation({
    mutationFn: (accountIds: string[]) => backend.syncAdminUserAssignments(apiFetch, assignmentUser!.id, accountIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-user-assignments'] });
      setAssignmentOpen(false);
      toast.success('Vinculos salvos');
    },
    onError: () => toast.error('Falha ao salvar vinculos'),
  });

  const selectionCount = selectedAccounts.size;

  return (
    <RoleGuard roles={['ADMIN']}>
      <div className="space-y-6">
        <PageHeader
          title="Usuarios"
          description="Cadastre, edite e vincule contas por coordenador."
          actions={<Button onClick={openCreate}>Novo usuario</Button>}
        />

        <Card className="card-glow">
          <CardContent className="space-y-4">
            <Input
              placeholder="Buscar por nome ou username"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />

            <div className="overflow-auto rounded-2xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando usuarios...
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum usuario encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs uppercase">
                            {formatRole(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={user.active} onCheckedChange={() => toggleActiveMutation.mutate(user)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                              Editar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openAssignments(user)}>
                              Vincular contas
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setResetOpen(true);
                              }}
                            >
                              Resetar senha
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{formMode === 'create' ? 'Novo usuario' : 'Editar usuario'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="login" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="COORDINATOR">COORDENADOR</SelectItem>
                          <SelectItem value="CONTROLLER">CONTROLLER</SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div>
                          <FormLabel>Ativo</FormLabel>
                          <p className="text-xs text-muted-foreground">Permite login</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mustChangePassword"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div>
                          <FormLabel>Forcar troca</FormLabel>
                          <p className="text-xs text-muted-foreground">Primeiro acesso</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {formMode === 'create' && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha inicial</FormLabel>
                        <FormControl>
                          <Input placeholder="123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resetar senha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirma resetar a senha de <span className="font-medium text-foreground">{selectedUser?.name}</span>?
              </p>
              <Input
                placeholder="Nova senha (opcional)"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setResetOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignmentOpen} onOpenChange={handleAssignmentsOpenChange}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Vincular contas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Usuario selecionado</div>
                  <div className="text-base font-semibold">
                    {assignmentUser?.name} <span className="text-sm text-muted-foreground">({assignmentUser?.username})</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectionCount} contas selecionadas
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select value={filterProacao} onValueChange={setFilterProacao}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filtrar Pro Acao" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {proacoes.map((proacao) => (
                      <SelectItem key={proacao.id} value={proacao.id}>
                        {proacao.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Buscar conta"
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  className="w-72"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!assignmentData) return;
                    const ids = assignmentData.accounts
                      .filter((account) => filterProacao === 'all' || account.proacao.id === filterProacao)
                      .map((account) => account.id);
                    setSelectedAccounts(new Set([...selectedAccounts, ...ids]));
                  }}
                >
                  Selecionar todas desta Pro Acao
                </Button>
                <Button variant="ghost" onClick={() => setSelectedAccounts(new Set())}>
                  Limpar selecao
                </Button>
              </div>

              <div className="h-[420px] overflow-auto rounded-2xl border border-border/60">
                {assignmentsQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredAccounts.map((account) => {
                      const checked = selectedAccounts.has(account.id);
                      return (
                        <label
                          key={account.id}
                          className={cn(
                            'flex items-center justify-between px-4 py-3 text-sm',
                            checked && 'bg-[color:var(--surface-2)]',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const next = new Set(selectedAccounts);
                                if (value) {
                                  next.add(account.id);
                                } else {
                                  next.delete(account.id);
                                }
                                setSelectedAccounts(next);
                              }}
                            />
                            <div>
                              <div className="font-medium">{account.code} - {account.label}</div>
                              <div className="text-xs text-muted-foreground">{account.proacao.name}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {filteredAccounts.length === 0 && (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAssignmentOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => syncAssignmentsMutation.mutate(Array.from(selectedAccounts))}
                  disabled={syncAssignmentsMutation.isPending}
                >
                  Salvar vinculos
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
