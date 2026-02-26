'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ChartPie, LayoutGrid, Moon, ShieldCheck, Sun, Target, UserCheck, Users, Wallet } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import type { ComponentType } from 'react';
import { useTheme } from 'next-themes';

type NavRole = 'ADMIN' | 'CONTROLLER' | 'COORDINATOR';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: NavRole[];
  hidden?: boolean;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['ADMIN', 'CONTROLLER'] },
  { href: '/audit', label: 'Auditoria', icon: ShieldCheck, roles: ['ADMIN', 'CONTROLLER'] },
  { href: '/planejamento', label: 'Contas por Coordenador', icon: ChartPie, roles: ['ADMIN', 'CONTROLLER', 'COORDINATOR'] },
  { href: '/dre/analises', label: 'Analises DRE', icon: BarChart3, roles: ['ADMIN', 'CONTROLLER', 'COORDINATOR'] },
  { href: '/bsc/map', label: 'Estrategia BSC', icon: Target, roles: ['ADMIN', 'CONTROLLER', 'COORDINATOR'] },
  { href: '/minhas-contas', label: 'Minhas Contas', icon: UserCheck, roles: ['ADMIN', 'CONTROLLER'], hidden: true },
  { href: '/padrinhos', label: 'Gestao de Coordenador', icon: Users, roles: ['ADMIN'], hidden: true },
  { href: '/orcamentos', label: 'Orcamentos', icon: Wallet, roles: ['ADMIN'], hidden: true },
];

interface SidebarNavProps {
  onNavigate?: () => void;
  showSectionTitle?: boolean;
}

export function SidebarNav({ onNavigate, showSectionTitle = true }: SidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = useMemo(
    () => navItems.filter((item) => user && item.roles.includes(user.role as NavRole) && !item.hidden),
    [user],
  );

  if (!user) return null;

  return (
    <nav className="space-y-1.5">
      {showSectionTitle ? (
        <div className="px-2 pb-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Menu</div>
        </div>
      ) : null}

      {visibleItems.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-[color:var(--surface-1)] hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                active
                  ? 'border-[color:var(--accent-border)] bg-[color:var(--surface-2)] text-[color:var(--accent)]'
                  : 'border-border/60 bg-[color:var(--surface-2)] text-muted-foreground group-hover:text-[color:var(--accent)]',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

interface SidebarProps {
  className?: string;
}

function ThemeModeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/70 bg-[color:var(--surface-1)] p-2',
          compact ? 'w-full' : '',
        )}
      >
        <div className="h-8 rounded-lg bg-[color:var(--surface-2)]/60" />
      </div>
    );
  }

  const activeTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <div className={cn('rounded-xl border border-border/70 bg-[color:var(--surface-1)] p-2', compact ? 'w-full' : '')}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tema</div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cn(
            'inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
            activeTheme === 'light'
              ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
              : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:text-foreground',
          )}
          aria-label="Ativar modo claro"
        >
          <Sun className="h-3.5 w-3.5" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cn(
            'inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
            activeTheme === 'dark'
              ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
              : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:text-foreground',
          )}
          aria-label="Ativar modo escuro"
        >
          <Moon className="h-3.5 w-3.5" />
          Dark
        </button>
      </div>
    </div>
  );
}

export { ThemeModeSwitch };

export function Sidebar({ className }: SidebarProps) {
  const { user } = useAuth();
  const visibleItems = useMemo(
    () => navItems.filter((item) => user && item.roles.includes(user.role as NavRole) && !item.hidden),
    [user],
  );

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-border/70 bg-[color:var(--sidebar)] px-3 py-4',
        className,
      )}
    >
      <div className="mb-4 space-y-2 px-1">
        <div className="text-lg font-semibold tracking-tight text-foreground">Printbag</div>
        <div className="text-xs text-muted-foreground">Planejamento Orcamentario</div>
        <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-[10px] text-muted-foreground">
          {visibleItems.length} modulos
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNav />
      </div>

      <div className="mt-4 space-y-2">
        <ThemeModeSwitch />
        <div className="rounded-xl border border-border/70 bg-[color:var(--surface-1)] px-3 py-2 text-[11px] text-muted-foreground">
          Backend conectado e sessao autenticada.
        </div>
      </div>
    </aside>
  );
}
