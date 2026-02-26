'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { useSelectedBudget } from '@/hooks/use-selected-budget';
import { Budget } from '@/lib/types';

function buildBudgetLabel(budget: Budget, yearCounts: Map<number, number>) {
  const count = yearCounts.get(budget.year) ?? 0;
  const suffix = count > 1 ? ` (v${budget.version})` : '';
  return `${budget.name} (${budget.year})${suffix}`;
}

export function BudgetSelector() {
  const { apiFetch } = useApiClient();
  const { budgetId, setBudgetId } = useSelectedBudget();
  const { data = [] } = useQuery({ queryKey: ['budgets'], queryFn: () => backend.listBudgets(apiFetch), staleTime: 2 * 60_000, gcTime: 10 * 60_000 });

  const visibleBudgets = useMemo(() => {
    return data
      .filter(
        (budget) =>
          budget.kind === 'BUDGET' &&
          (budget.status === 'READY' || budget.status === 'PROCESSING'),
      )
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      });
  }, [data]);

  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>();
    visibleBudgets.forEach((budget) => {
      counts.set(budget.year, (counts.get(budget.year) ?? 0) + 1);
    });
    return counts;
  }, [visibleBudgets]);

  const readyBudgets = visibleBudgets.filter((budget) => budget.status === 'READY');
  const activeBudget = readyBudgets.find((budget) => budget.isActive);

  const selected = useMemo(() => {
    return visibleBudgets.find((item) => item.id === budgetId) ?? activeBudget ?? readyBudgets[0] ?? null;
  }, [visibleBudgets, budgetId, activeBudget, readyBudgets]);

  useEffect(() => {
    if ((!budgetId && selected) || (budgetId && !selected && readyBudgets[0])) {
      setBudgetId((selected ?? readyBudgets[0]).id);
    }
  }, [budgetId, selected, readyBudgets, setBudgetId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[260px] justify-between hover:bg-[color:var(--surface-2)] hover:text-foreground"
        >
          <span>{selected ? buildBudgetLabel(selected, yearCounts) : 'Selecione um orcamento'}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar orcamento" />
          <CommandList>
            <CommandEmpty>Nenhum orcamento</CommandEmpty>
            <CommandGroup>
              {visibleBudgets.map((item) => {
                const label = buildBudgetLabel(item, yearCounts);
                const disabled = item.status === 'PROCESSING';
                return (
                  <CommandItem
                    key={item.id}
                    value={label}
                    onSelect={() => {
                      if (disabled) return;
                      setBudgetId(item.id);
                    }}
                    className={cn(disabled && 'opacity-60')}
                  >
                    <Check className={cn('mr-2 h-4 w-4', item.id === selected?.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{label}</span>
                    {disabled && <span className="text-[11px] text-muted-foreground">Processando</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
