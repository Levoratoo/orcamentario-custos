'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { Account, CostCenter, DriverType } from '@/lib/types';
import { monthKeys, normalizeMonthly } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface BudgetLineDialogProps {
  scenarioId: string;
  costCenters: CostCenter[];
  accounts: Account[];
}

export function BudgetLineDialog({ scenarioId, costCenters, accounts }: BudgetLineDialogProps) {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [costCenterId, setCostCenterId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [driverType, setDriverType] = useState<DriverType>('FIXED');
  const [assumptions, setAssumptions] = useState('');
  const [value, setValue] = useState('0.00');

  const mutation = useMutation({
    mutationFn: () =>
      backend.createBudgetLine(apiFetch, {
        scenarioId,
        costCenterId,
        accountId,
        description,
        driverType,
        assumptions,
        monthlyValues: normalizeMonthly(Object.fromEntries(monthKeys.map((key) => [key, value]))),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', scenarioId] });
      toast.success('Linha criada');
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Adicionar Linha</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova linha orcamentaria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={costCenterId} onValueChange={setCostCenterId}>
            <SelectTrigger>
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.code} - {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Select value={driverType} onValueChange={(value) => setDriverType(value as DriverType)}>
            <SelectTrigger>
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent>
              {['FIXED','HEADCOUNT','PERCENT_PAYROLL','CONTRACT','CONSUMPTION','OTHER'].map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Premissas" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
          <Input placeholder="Valor padrao (todos meses)" value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !costCenterId || !accountId}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
