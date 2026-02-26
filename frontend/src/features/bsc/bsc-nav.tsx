'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/bsc/map', label: 'Mapa Estrategico' },
  { href: '/bsc/management', label: 'Gestao Mensal' },
  { href: '/bsc/execution', label: 'Execucao' },
];

export function BscNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              active
                ? 'border-[color:var(--accent-border)] bg-[color:var(--accent)] text-white shadow-sm'
                : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)] hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

