'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { Card } from '@/components/ui/card';
import { RoleGuard } from '@/components/shared/role-guard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ScenariosPage() {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [year, setYear] = useState('2026');

  const { data = [] } = useQuery({ queryKey: ['scenarios'], queryFn: () => backend.listScenarios(apiFetch) });

  const createMutation = useMutation({
    mutationFn: () => backend.createScenario(apiFetch, { name, year: Number(year) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      toast.success('Cenario criado');
      setOpen(false);
    },
  });

  return (
    <RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cenarios</h1>
          <p className="text-sm text-muted-foreground">Gerencie ciclos orcamentarios.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Criar cenario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cenario</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
              <Input placeholder="Ano" value={year} onChange={(event) => setYear(event.target.value)} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((scenario) => (
              <TableRow key={scenario.id}>
                <TableCell>{scenario.name}</TableCell>
                <TableCell>{scenario.year}</TableCell>
                <TableCell>{scenario.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      </div>
    </RoleGuard>
  );
}
