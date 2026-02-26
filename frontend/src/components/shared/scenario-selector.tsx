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
import { useSelectedScenario } from '@/hooks/use-selected-scenario';

export function ScenarioSelector() {
  const { apiFetch } = useApiClient();
  const { scenarioId, setScenarioId } = useSelectedScenario();
  const { data = [] } = useQuery({ queryKey: ['scenarios'], queryFn: () => backend.listScenarios(apiFetch) });

  const selected = useMemo(() => data.find((item) => item.id === scenarioId) || data[0], [data, scenarioId]);

  useEffect(() => {
    if (!scenarioId && selected) {
      setScenarioId(selected.id);
    }
  }, [scenarioId, selected, setScenarioId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[240px] justify-between hover:bg-[color:var(--surface-2)] hover:text-foreground"
        >
          <span>{selected ? selected.name : 'Selecione um cenario'}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cenario" />
          <CommandList>
            <CommandEmpty>Nenhum cenario</CommandEmpty>
            <CommandGroup>
              {data.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => setScenarioId(item.id)}
                >
                  <Check className={cn('mr-2 h-4 w-4', item.id === selected?.id ? 'opacity-100' : 'opacity-0')} />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
