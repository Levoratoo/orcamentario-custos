'use client';

import { Button } from '@/components/ui/button';
import { useDreMode } from '@/hooks/use-dre-mode';
import { DreMode } from '@/services/dre/types';

const modes: Array<{ key: DreMode; label: string }> = [
  { key: 'previsto', label: 'Orcado' },
  { key: 'realizado', label: 'Realizado' },
  { key: 'projetado', label: 'Variacao' },
];

export function DreModeToggle() {
  const { mode, setMode } = useDreMode();

  return (
    <div className="flex items-center gap-1">
      {modes.map((item) => (
        <Button
          key={item.key}
          size="sm"
          variant={mode === item.key ? 'default' : 'outline'}
          onClick={() => setMode(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
