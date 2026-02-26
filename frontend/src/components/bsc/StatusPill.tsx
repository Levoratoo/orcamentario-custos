'use client';

import { cn } from '@/lib/utils';

export type BscStatus = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA' | 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADOS';

const LABEL_BY_STATUS: Record<BscStatus, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarelo',
  RED: 'Vermelho',
  NO_DATA: 'Sem dados',
  VERDE: 'Verde',
  AMARELO: 'Amarelo',
  VERMELHO: 'Vermelho',
  SEM_DADOS: 'Sem dados',
};

export function StatusPill({ status }: { status: BscStatus }) {
  const normalized =
    status === 'VERDE'
      ? 'GREEN'
      : status === 'AMARELO'
        ? 'YELLOW'
        : status === 'VERMELHO'
          ? 'RED'
          : status === 'SEM_DADOS'
            ? 'NO_DATA'
            : status;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        normalized === 'GREEN' && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
        normalized === 'YELLOW' && 'border-amber-500/50 bg-amber-500/15 text-amber-300',
        normalized === 'RED' && 'border-rose-500/50 bg-rose-500/15 text-rose-300',
        normalized === 'NO_DATA' && 'border-slate-500/50 bg-slate-500/15 text-slate-300',
      )}
    >
      {LABEL_BY_STATUS[status]}
    </span>
  );
}
