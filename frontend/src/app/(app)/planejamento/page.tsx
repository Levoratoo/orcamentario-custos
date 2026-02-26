'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { backend, type PlanningAuditIssue } from '@/services/backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyBRL } from '@/lib/formatters';
import { rechartsTheme } from '@/lib/recharts-theme';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import {
  CalendarRange,
  ChevronDown,
  Filter,
  Layers3,
  ListChecks,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const months = Array.from({ length: 12 }, (_, index) => index + 1);
const quarterLabels = ['T1', 'T2', 'T3', 'T4'] as const;

type ViewMode = 'month' | 'quarter' | 'year';

function parseInput(value: string) {
  if (!value) return 0;
  const normalized = value.replace(/[^0-9\-]/g, '');
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatMoney(value: number) {
  if (value === 0) return '--';
  const absValue = Math.abs(value);
  const formatted = `R$ ${formatNumber(absValue)}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function formatCompactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(value)}`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function formatMonthLabel(month: number, year: number) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

function getVisibleMonths(viewMode: ViewMode, selectedMonth: number, selectedQuarter: number) {
  if (viewMode === 'month') return [selectedMonth];
  if (viewMode === 'quarter') {
    const start = (selectedQuarter - 1) * 3 + 1;
    return [start, start + 1, start + 2];
  }
  return months;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface HeaderSummaryProps {
  year: number;
  totalYear: number;
  totalVisible: number;
  topAccount?: { label: string; total: number } | null;
  activeCount: number;
}

function HeaderSummary({ year, totalYear, totalVisible, topAccount, activeCount }: HeaderSummaryProps) {
  const cards = [
    {
      title: 'Total do ano',
      value: formatMoney(totalYear),
      subtitle: `Ano ${year}`,
      hint: 'Consolidado anual',
      icon: CalendarRange,
    },
    {
      title: 'Total do periodo',
      value: formatMoney(totalVisible),
      subtitle: 'Visao atual',
      hint: 'Recorte aplicado',
      icon: Layers3,
    },
    {
      title: 'Top 1 conta',
      value: topAccount ? formatMoney(topAccount.total) : '--',
      subtitle: topAccount?.label ?? 'Sem dados',
      hint: 'Maior impacto',
      icon: Trophy,
    },
    {
      title: 'Contas ativas',
      value: String(activeCount),
      subtitle: 'Linhas com valor',
      hint: 'Registros editaveis',
      icon: ListChecks,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="group relative overflow-hidden rounded-2xl border-border/70 bg-[color:var(--surface-1)] shadow-sm"
        >
          <CardContent className="relative space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{card.title}</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                <card.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="text-[34px] font-semibold leading-none text-foreground tabular-nums">{card.value}</div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="line-clamp-1 text-xs text-muted-foreground">{card.subtitle}</div>
              <Badge className="border border-border/70 bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {card.hint}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  resultCount: number;
  totalCount: number;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  year: number;
  onYearChange: (value: number) => void;
  years: number[];
  periodValue: number;
  onPeriodChange: (value: number) => void;
  showPeriod: boolean;
  periodOptions: Array<{ value: number; label: string }>;
  invert: boolean;
  onInvert: () => void;
  onClearFilters: () => void;
  isAdmin: boolean;
  coordinators: Array<{ id: string; name: string }>;
  selectedCoordinatorId: string;
  onCoordinatorChange: (value: string) => void;
}

function FilterBar({
  search,
  onSearchChange,
  onClearSearch,
  resultCount,
  totalCount,
  viewMode,
  onViewModeChange,
  year,
  onYearChange,
  years,
  periodValue,
  onPeriodChange,
  showPeriod,
  periodOptions,
  invert,
  onInvert,
  onClearFilters,
  isAdmin,
  coordinators,
  selectedCoordinatorId,
  onCoordinatorChange,
}: FilterBarProps) {
  return (
    <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <Sparkles className="mr-1.5 h-3 w-3" />
            Filtros ativos
          </Badge>
          <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
            {resultCount} de {totalCount} contas
          </Badge>
          {invert && (
            <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
              Visualizacao invertida
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-full border border-border/70 bg-[color:var(--surface-3)] px-3 py-2 shadow-inner shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar conta por nome ou codigo"
              className="h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
            {search && (
              <button className="text-muted-foreground hover:text-foreground" onClick={onClearSearch}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && coordinators.length > 0 && (
              <Select value={selectedCoordinatorId} onValueChange={onCoordinatorChange}>
                <SelectTrigger className="h-9 w-44 border-border/70 bg-[color:var(--surface-1)]">
                  <SelectValue placeholder="Coordenador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {coordinators.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
              <SelectTrigger className="h-9 w-36 border-border/70 bg-[color:var(--surface-1)]">
                <SelectValue placeholder="Visao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mes</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
              </SelectContent>
            </Select>

            {showPeriod && (
              <Select value={String(periodValue)} onValueChange={(value) => onPeriodChange(Number(value))}>
                <SelectTrigger className="h-9 w-28 border-border/70 bg-[color:var(--surface-1)]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.label} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
              <SelectTrigger className="h-9 w-28 border-border/70 bg-[color:var(--surface-1)]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="border border-border/70" onClick={onClearFilters}>
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Limpar
            </Button>
            <Button variant="ghost" size="sm" className="border border-border/70" onClick={onInvert}>
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              {invert ? 'Invertido' : 'Inverter'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryTabsProps {
  items: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function CategoryTabs({ items, selectedId, onSelect }: CategoryTabsProps) {
  const visible = items.slice(0, 6);
  const hidden = items.slice(6);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((item) => {
        const active = selectedId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
              active
                ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)] shadow-sm'
                : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:border-[color:var(--accent-border)] hover:text-foreground',
            )}
          >
            <span className="max-w-[180px] truncate">{item.name}</span>
          </button>
        );
      })}

      {hidden.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-full border border-border/70 bg-[color:var(--surface-1)]">
              Mais
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {hidden.map((item) => {
              return (
                <DropdownMenuItem key={item.id} onClick={() => onSelect(item.id)}>
                  <span className="truncate">{item.name}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface BudgetTableProps {
  accounts: Array<{
    id: string;
    label: string;
    code: string;
    values: Record<number, number>;
    lockedByMonth?: Record<number, boolean>;
  }>;
  visibleMonths: number[];
  year: number;
  valuesByAccount: Record<string, Record<number, number>>;
  lockedByAccount: Record<string, Record<number, boolean>>;
  draftByCell: Record<string, string>;
  statusMap: Record<string, 'idle' | 'saving' | 'saved' | 'error'>;
  invert: boolean;
  accountColumnWidth: number;
  onAccountColumnWidthChange: (next: number) => void;
  onValueChange: (accountId: string, month: number, rawValue: string) => void;
  onValueBlur: (accountId: string, month: number) => void;
  onRowClick: (accountId: string) => void;
  canEditLocked: boolean;
}

function BudgetTable({
  accounts,
  visibleMonths,
  year,
  valuesByAccount,
  lockedByAccount,
  draftByCell,
  statusMap,
  invert,
  accountColumnWidth,
  onAccountColumnWidthChange,
  onValueChange,
  onValueBlur,
  onRowClick,
  canEditLocked,
}: BudgetTableProps) {
  const monthColumnWidth = 260;
  const totalColumnWidth = 220;
  const minAccountColumnWidth = 180;
  const maxAccountColumnWidth = 700;
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const clampAccountWidth = useCallback(
    (value: number) => Math.max(minAccountColumnWidth, Math.min(maxAccountColumnWidth, value)),
    [],
  );

  const startAccountResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStateRef.current = { startX: event.clientX, startWidth: accountColumnWidth };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const current = resizeStateRef.current;
        if (!current) return;
        const next = clampAccountWidth(current.startWidth + (moveEvent.clientX - current.startX));
        onAccountColumnWidthChange(next);
      };

      const stopResize = () => {
        resizeStateRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResize);
        cleanupRef.current = null;
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResize);
      cleanupRef.current = stopResize;
    },
    [accountColumnWidth, clampAccountWidth, onAccountColumnWidthChange],
  );

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const tableMinWidth = accountColumnWidth + visibleMonths.length * monthColumnWidth + totalColumnWidth;
  const accountColumnStyle = {
    width: `${accountColumnWidth}px`,
    minWidth: `${accountColumnWidth}px`,
    maxWidth: `${accountColumnWidth}px`,
  };

  const monthlyTotals = useMemo(() => {
    const byMonth: Record<number, number> = {};
    months.forEach((month) => {
      byMonth[month] = 0;
    });
    accounts.forEach((account) => {
      const values = valuesByAccount[account.id] ?? {};
      months.forEach((month) => {
        byMonth[month] += values[month] ?? 0;
      });
    });
    return byMonth;
  }, [accounts, valuesByAccount]);

  const visibleMonthsTotal = useMemo(
    () => visibleMonths.reduce((sum, month) => sum + (monthlyTotals[month] ?? 0), 0),
    [visibleMonths, monthlyTotals],
  );

  return (
    <div className="relative w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain rounded-xl border border-border/70 bg-[color:var(--surface-1)] shadow-sm">
      <div
        className="absolute bottom-0 top-0 z-50 w-3 -translate-x-1.5 cursor-col-resize bg-transparent"
        style={{ left: `${accountColumnWidth}px` }}
        onMouseDown={startAccountResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar coluna de conta"
      >
        <div className="mx-auto h-full w-px bg-[color:var(--accent)]/60" />
        <div className="absolute left-1/2 top-1/2 h-8 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent)]/90 shadow-sm" />
      </div>
      <table className="w-max text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
        <thead className="bg-[color:var(--surface-3)]/95">
          <tr className="text-muted-foreground">
            <th
              className="sticky left-0 top-0 z-50 bg-[color:var(--surface-3)] px-4 py-3 text-left text-xs uppercase tracking-wide"
              style={accountColumnStyle}
            >
              Conta
            </th>
            {visibleMonths.map((month) => (
              <th
                key={month}
                className="sticky top-0 z-40 min-w-[260px] bg-[color:var(--surface-3)] px-3 py-3 text-right text-xs uppercase tracking-wide"
              >
                {String(month).padStart(2, '0')}/{year}
              </th>
            ))}
            <th className="sticky right-0 top-0 z-50 min-w-[220px] bg-[color:var(--surface-3)] px-4 py-3 text-right text-xs uppercase tracking-wide">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr className="border-t border-border/60">
              <td colSpan={visibleMonths.length + 2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma conta atribuida.
              </td>
            </tr>
          ) : (
            accounts.map((account, index) => {
              const values = valuesByAccount[account.id] ?? {};
              const rowTotal = months.reduce((sum, month) => sum + (values[month] ?? 0), 0);
              return (
                <tr
                  key={account.id}
                  className={cn(
                    'border-t border-border/40 transition hover:bg-[color:var(--accent-soft)]/35',
                    index % 2 === 1 && 'bg-[color:var(--surface-2)]/35',
                  )}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).tagName.toLowerCase() === 'input') return;
                    onRowClick(account.id);
                  }}
                >
                  <td className="sticky left-0 z-10 bg-[color:var(--surface-1)] px-4 py-2 font-medium shadow-sm" style={accountColumnStyle}>
                    <div className="truncate">{account.label}</div>
                    <div className="text-xs text-muted-foreground">{account.code}</div>
                  </td>
                  {visibleMonths.map((month) => {
                    const key = `${account.id}-${month}`;
                    const value = values[month] ?? 0;
                    const display = invert ? -value : value;
                    const draft = draftByCell[key];
                    const hasValue = display !== 0;
                    const status = statusMap[key] ?? 'idle';
                    const formatted = draft ?? (hasValue ? `R$ ${formatNumber(display)}` : '');
                    const isLocked = lockedByAccount[account.id]?.[month] ?? false;
                    const isDisabled = isLocked && !canEditLocked;
                    return (
                      <td key={key} className="min-w-[260px] px-3 py-2 text-right whitespace-nowrap">
                        <div className="relative">
                          <Input
                            inputMode="numeric"
                            value={formatted}
                            placeholder="--"
                            onChange={(event) => onValueChange(account.id, month, event.target.value)}
                            onBlur={() => onValueBlur(account.id, month)}
                            className={cn(
                              'h-9 w-full min-w-[260px] border-border/70 bg-[color:var(--surface-1)]/85 text-right tabular-nums shadow-inner shadow-sm focus-visible:ring-[color:var(--accent)]/35',
                              status === 'saved' && hasValue && 'border-[color:var(--accent)]',
                              display < 0 && 'text-rose-400',
                              isDisabled && 'cursor-not-allowed opacity-60',
                            )}
                            disabled={isDisabled}
                          />
                          {status === 'saved' && hasValue && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 min-w-[220px] bg-[color:var(--surface-1)] px-4 py-2 text-right font-semibold tabular-nums shadow-sm">
                    {formatCurrencyBRL(invert ? -rowTotal : rowTotal)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {accounts.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-[color:var(--accent-border)] bg-[color:var(--surface-2)]/90">
              <td className="sticky left-0 z-20 bg-[color:var(--surface-2)] px-4 py-2 font-semibold" style={accountColumnStyle}>
                Somatoria por mes
              </td>
              {visibleMonths.map((month) => {
                const value = invert ? -(monthlyTotals[month] ?? 0) : (monthlyTotals[month] ?? 0);
                return (
                  <td key={`total-${month}`} className="min-w-[260px] px-3 py-2 text-right font-semibold tabular-nums">
                    {formatCurrencyBRL(value)}
                  </td>
                );
              })}
              <td className="sticky right-0 z-20 min-w-[220px] bg-[color:var(--surface-2)] px-4 py-2 text-right font-semibold tabular-nums">
                {formatCurrencyBRL(invert ? -visibleMonthsTotal : visibleMonthsTotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

interface AccountDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: { label: string; code: string; values: Record<number, number> } | null;
  year: number;
  invert: boolean;
}

function AccountDetailDrawer({ open, onOpenChange, account, year, invert }: AccountDetailDrawerProps) {
  const rows = useMemo(() => {
    if (!account) return [];
    return months.map((month) => {
      const value = account.values[month] ?? 0;
      const display = invert ? -value : value;
      return { month, value: display };
    });
  }, [account, invert]);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md border-l border-border/70 bg-[color:var(--surface-1)]">
        <SheetHeader>
          <SheetTitle>Detalhe da conta</SheetTitle>
        </SheetHeader>
        {account ? (
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">{account.code}</div>
              <div className="text-lg font-semibold">{account.label}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3 shadow-sm">
              <div className="text-xs uppercase text-muted-foreground">Total anual</div>
              <div className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</div>
              <div className="text-xs text-muted-foreground">Ano {year}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Meses</div>
              <div className="max-h-[360px] space-y-2 overflow-auto">
                {rows.map((row) => (
                  <div key={row.month} className="flex items-center justify-between rounded-lg border border-border/70 bg-[color:var(--surface-1)]/85 px-3 py-2 text-sm">
                    <span>{String(row.month).padStart(2, '0')}/{year}</span>
                    <span className={cn('font-medium tabular-nums', row.value < 0 && 'text-rose-500')}>
                      {formatMoney(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="border-border/70 bg-[color:var(--surface-1)]"
              onClick={() => {
                const summary = `${account.label} - ${formatMoney(total)}`;
                navigator.clipboard.writeText(summary);
              }}
            >
              Copiar resumo
            </Button>
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">Selecione uma conta para ver o detalhe.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function PlanningPage() {
  const { apiFetch } = useApiClient();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedProacao, setSelectedProacao] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const [invert, setInvert] = useState(false);
  const [valuesByAccount, setValuesByAccount] = useState<Record<string, Record<number, number>>>({});
  const [lockedByAccount, setLockedByAccount] = useState<Record<string, Record<number, boolean>>>({});
  const [draftByCell, setDraftByCell] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('year');
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
  const [accountColumnWidth, setAccountColumnWidth] = useState(220);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const proacoesQuery = useQuery({
    queryKey: ['planning-proacoes', selectedCoordinatorId],
    queryFn: () =>
      backend.listPlanningProacoes(
        apiFetch,
        user?.role === 'ADMIN' && selectedCoordinatorId !== 'all' ? selectedCoordinatorId : undefined,
      ),
  });
  const proacoes = proacoesQuery.data ?? [];

  const { data: yearOptions = [] } = useQuery({
    queryKey: ['planning-years', selectedCoordinatorId],
    queryFn: () =>
      backend.listPlanningYears(
        apiFetch,
        user?.role === 'ADMIN' && selectedCoordinatorId !== 'all' ? selectedCoordinatorId : undefined,
      ),
  });

  const proacaoOptions = useMemo(() => {
    const base = [...proacoes];
    if (user?.role === 'ADMIN') {
      base.unshift({ id: 'all', name: 'Todos' });
    }
    return base;
  }, [proacoes, user?.role]);

  useEffect(() => {
    if (proacaoOptions.length === 0) {
      setSelectedProacao(null);
      return;
    }
    if (!selectedProacao || !proacaoOptions.some((item) => item.id === selectedProacao)) {
      setSelectedProacao(proacaoOptions[0].id);
    }
  }, [proacaoOptions, selectedProacao]);

  const { data: grid, refetch, isFetching } = useQuery({
    queryKey: ['planning-grid', selectedProacao, selectedYear, selectedCoordinatorId],
    enabled: Boolean(selectedProacao),
    queryFn: () =>
      backend.getPlanningGrid(
        apiFetch,
        selectedProacao!,
        selectedYear,
        user?.role === 'ADMIN' && selectedCoordinatorId !== 'all' ? selectedCoordinatorId : undefined,
      ),
  });

  const summaryQuery = useQuery({
    queryKey: ['planning-summary', selectedProacao, selectedYear, selectedCoordinatorId],
    enabled: Boolean(selectedProacao),
    queryFn: () =>
      backend.getPlanningSummary(
        apiFetch,
        selectedProacao!,
        selectedYear,
        user?.role === 'ADMIN' && selectedCoordinatorId !== 'all' ? selectedCoordinatorId : undefined,
      ),
  });
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditDraftByIssue, setAuditDraftByIssue] = useState<Record<string, string>>({});
  const [auditSavingByIssue, setAuditSavingByIssue] = useState<Record<string, boolean>>({});
  const auditQuery = useQuery({
    queryKey: ['planning-audit', selectedProacao, selectedYear, selectedCoordinatorId],
    enabled: false,
    queryFn: () =>
      backend.getPlanningAudit(
        apiFetch,
        selectedProacao!,
        selectedYear,
        user?.role === 'ADMIN' && selectedCoordinatorId !== 'all' ? selectedCoordinatorId : undefined,
      ),
  });

  useEffect(() => {
    if (!grid) return;
    const next: Record<string, Record<number, number>> = {};
    const nextLocked: Record<string, Record<number, boolean>> = {};
    grid.accounts.forEach((account) => {
      next[account.id] = { ...account.values };
      nextLocked[account.id] = { ...(account.lockedByMonth ?? {}) };
    });
    setValuesByAccount(next);
    setLockedByAccount(nextLocked);
    setStatusMap({});
  }, [grid]);

  const filteredAccounts = useMemo(() => {
    if (!grid) return [];
    const target = debouncedSearch.trim().toLowerCase();
    if (!target) return grid.accounts;
    return grid.accounts.filter((account) => {
      return account.label.toLowerCase().includes(target) || account.code.toLowerCase().includes(target);
    });
  }, [grid, debouncedSearch]);

  const visibleMonths = useMemo(
    () => getVisibleMonths(viewMode, selectedMonth, selectedQuarter),
    [viewMode, selectedMonth, selectedQuarter],
  );

  const totals = useMemo(() => {
    const accounts = filteredAccounts;
    const totalsByAccount = accounts.map((account) => {
      const values = valuesByAccount[account.id] ?? {};
      const annual = months.reduce((sum, month) => sum + (values[month] ?? 0), 0);
      const visible = visibleMonths.reduce((sum, month) => sum + (values[month] ?? 0), 0);
      return { id: account.id, label: account.label, annual, visible };
    });
    const totalYear = totalsByAccount.reduce((sum, item) => sum + item.annual, 0);
    const totalVisible = totalsByAccount.reduce((sum, item) => sum + item.visible, 0);
    const top = totalsByAccount
      .filter((item) => item.annual !== 0)
      .sort((a, b) => Math.abs(b.annual) - Math.abs(a.annual))[0];
    const activeCount = totalsByAccount.filter((item) => item.annual !== 0).length;
    return { totalYear, totalVisible, top, activeCount };
  }, [filteredAccounts, valuesByAccount, visibleMonths]);

  const handleValueChange = (accountId: string, month: number, rawValue: string) => {
    if (!grid) return;
    if (lockedByAccount[accountId]?.[month] && user?.role !== 'ADMIN') return;
    const parsed = parseInput(rawValue);
    const nextValue = invert ? -parsed : parsed;
    const key = `${accountId}-${month}`;
    setDraftByCell((prev) => ({ ...prev, [key]: rawValue }));
    setValuesByAccount((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], [month]: nextValue },
    }));

    setStatusMap((prev) => ({ ...prev, [key]: 'saving' }));

    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
    }

    timersRef.current[key] = setTimeout(async () => {
      try {
        await backend.updatePlanningValue(apiFetch, {
          accountId,
          year: selectedYear,
          month,
          value: nextValue,
        });
        setStatusMap((prev) => ({ ...prev, [key]: 'saved' }));
        if (summaryQuery.refetch) {
          if (timersRef.current.summary) {
            clearTimeout(timersRef.current.summary);
          }
          timersRef.current.summary = setTimeout(() => {
            summaryQuery.refetch();
          }, 800);
        }
      } catch {
        setStatusMap((prev) => ({ ...prev, [key]: 'idle' }));
      }
    }, 700);
  };

  const hasLockedCells = useMemo(
    () =>
      Object.values(lockedByAccount).some((monthsMap) =>
        Object.values(monthsMap ?? {}).some((isLocked) => Boolean(isLocked)),
      ),
    [lockedByAccount],
  );

  const handleFinalize = useCallback(async () => {
    if (!selectedProacao) return;
    const confirmed = window.confirm(
      'Ao salvar, o coordenador nao podera mais editar este planejamento. Apenas ADM podera alterar depois. Deseja continuar?',
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    try {
      await backend.finalizePlanning(apiFetch, {
        proacaoId: selectedProacao,
        year: selectedYear,
      });
      toast.success('Planejamento salvo e bloqueado com sucesso.');
      await Promise.all([refetch(), summaryQuery.refetch()]);
    } catch {
      toast.error('Nao foi possivel salvar e bloquear o planejamento.');
    } finally {
      setIsFinalizing(false);
    }
  }, [apiFetch, refetch, selectedProacao, selectedYear, summaryQuery]);

  const handleValueBlur = (accountId: string, month: number) => {
    const key = `${accountId}-${month}`;
    setDraftByCell((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRunAudit = useCallback(async () => {
    if (!selectedProacao) return;
    setShowAuditPanel(true);
    const result = await auditQuery.refetch();
    if (result.error) {
      toast.error('Falha na varredura de consistencia.');
      return;
    }
    const total = result.data?.summary.totalIssues ?? 0;
    if (total === 0) {
      toast.success('Varredura concluida. Nenhuma inconsistencia encontrada.');
      return;
    }
    toast.warning(`Varredura concluida com ${total} inconsistencia(s).`);
  }, [auditQuery, selectedProacao]);

  const handleApplyAuditFix = useCallback(
    async (issue: PlanningAuditIssue) => {
      if (!issue.canEdit || !issue.accountId || !issue.month) return;
      const input = auditDraftByIssue[issue.id];
      const nextValue = parseInput(input ?? String(Math.trunc(issue.planningValue ?? 0)));
      setAuditSavingByIssue((prev) => ({ ...prev, [issue.id]: true }));
      try {
        await backend.updatePlanningValue(apiFetch, {
          accountId: issue.accountId,
          year: selectedYear,
          month: issue.month,
          value: nextValue,
        });
        toast.success(`Valor atualizado em ${formatMonthLabel(issue.month, selectedYear)}.`);
        await Promise.all([refetch(), summaryQuery.refetch(), auditQuery.refetch()]);
      } catch {
        toast.error('Nao foi possivel aplicar a correcao.');
      } finally {
        setAuditSavingByIssue((prev) => ({ ...prev, [issue.id]: false }));
      }
    },
    [apiFetch, auditDraftByIssue, auditQuery, refetch, selectedYear, summaryQuery],
  );

  const availableYears = useMemo(() => {
    const base = yearOptions.length > 0 ? [...yearOptions] : [2025, 2026];
    if (!base.includes(selectedYear)) base.push(selectedYear);
    return base.sort();
  }, [selectedYear, yearOptions]);

  const periodOptions = useMemo(() => {
    if (viewMode === 'month') {
      return months.map((month) => ({ value: month, label: String(month).padStart(2, '0') }));
    }
    return quarterLabels.map((label, index) => ({ value: index + 1, label }));
  }, [viewMode]);

  const selectedAccount = useMemo(() => {
    if (!grid || !detailAccountId) return null;
    return grid.accounts.find((account) => account.id === detailAccountId) ?? null;
  }, [grid, detailAccountId]);

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users'],
    enabled: user?.role === 'ADMIN',
    queryFn: () => backend.listAdminUsers(apiFetch, 1, 500),
  });

  const coordinators = useMemo(() => {
    const items = adminUsers?.items ?? [];
    return items.filter((item) => item.role === 'COORDINATOR' && item.active).map((item) => ({ id: item.id, name: item.name }));
  }, [adminUsers]);

  const summaryData = summaryQuery.data;
  const chartData = useMemo(() => {
    if (!summaryData) return [];
    return summaryData.chart.labels.map((label, index) => ({
      label,
      orcadoAnoAtual: summaryData.chart.series.orcadoAnoAtual[index] ?? 0,
      realizadoAnoAnt: summaryData.chart.series.realizadoAnoAnt[index] ?? 0,
      realizadoAnoAtual: summaryData.chart.series.realizadoAnoAtual[index] ?? 0,
      orcadoAnoAnt: summaryData.chart.series.orcadoAnoAnt[index] ?? 0,
      cenario: summaryData.chart.series.cenario[index] ?? 0,
    }));
  }, [summaryData]);

  const chartTotals = useMemo(() => {
    if (chartData.length === 0) {
      return {
        orcadoAtual: 0,
        realizadoAtual: 0,
        orcadoAnterior: 0,
        realizadoAnterior: 0,
        deltaAtual: 0,
        aderenciaAtual: null as number | null,
      };
    }

    const aggregated = chartData.reduce(
      (acc, item) => {
        acc.orcadoAtual += item.orcadoAnoAtual ?? 0;
        acc.realizadoAtual += item.realizadoAnoAtual ?? 0;
        acc.orcadoAnterior += item.orcadoAnoAnt ?? 0;
        acc.realizadoAnterior += item.realizadoAnoAnt ?? 0;
        return acc;
      },
      { orcadoAtual: 0, realizadoAtual: 0, orcadoAnterior: 0, realizadoAnterior: 0 },
    );

    const deltaAtual = aggregated.realizadoAtual - aggregated.orcadoAtual;
    const aderenciaAtual =
      aggregated.orcadoAtual !== 0 ? (aggregated.realizadoAtual / aggregated.orcadoAtual) * 100 : null;

    return { ...aggregated, deltaAtual, aderenciaAtual };
  }, [chartData]);

  const visibleRangeLabel = useMemo(() => {
    if (viewMode === 'year') return `Jan-Dez/${selectedYear}`;
    if (viewMode === 'quarter') {
      const start = (selectedQuarter - 1) * 3 + 1;
      const end = start + 2;
      return `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}/${selectedYear}`;
    }
    return `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
  }, [selectedMonth, selectedQuarter, selectedYear, viewMode]);

  const activeProacaoLabel = useMemo(() => {
    if (selectedProacao === 'all') return 'Todos';
    const match = proacoes.find((item) => item.id === selectedProacao);
    if (match) return match.name;
    if (proacoesQuery.isLoading) return 'Carregando...';
    return 'Nenhuma Pró Ação disponível';
  }, [selectedProacao, proacoes, proacoesQuery.isLoading]);

  const hasProacoes = proacaoOptions.length > 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Planejamento Orcamentario</div>
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--accent)]">Controle por coordenador</h1>
            <p className="text-sm text-muted-foreground">Visualize e edite o planejamento mensal por conta.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                <Sparkles className="mr-1.5 h-3 w-3" />
                Operacao guiada
              </Badge>
              <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">
                Ano base {selectedYear}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Pro acao ativa</div>
            <div className="mt-1 text-lg font-semibold text-[color:var(--accent)]">{activeProacaoLabel}</div>
            <div className="text-xs text-muted-foreground">Atualizado conforme os filtros da tela</div>
          </div>
        </CardContent>
      </Card>

      <HeaderSummary
        year={selectedYear}
        totalYear={totals.totalYear}
        totalVisible={totals.totalVisible}
        topAccount={totals.top ? { label: totals.top.label, total: totals.top.annual } : null}
        activeCount={totals.activeCount}
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        onClearSearch={() => setSearchInput('')}
        resultCount={filteredAccounts.length}
        totalCount={grid?.accounts.length ?? 0}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        year={selectedYear}
        onYearChange={setSelectedYear}
        years={availableYears}
        periodValue={viewMode === 'month' ? selectedMonth : selectedQuarter}
        onPeriodChange={(value) => (viewMode === 'month' ? setSelectedMonth(value) : setSelectedQuarter(value))}
        showPeriod={viewMode !== 'year'}
        periodOptions={periodOptions}
        invert={invert}
        onInvert={() => setInvert((prev) => !prev)}
        onClearFilters={() => {
          setSearchInput('');
          setInvert(false);
          setViewMode('year');
          setSelectedMonth(1);
          setSelectedQuarter(1);
          setSelectedCoordinatorId('all');
        }}
        isAdmin={user?.role === 'ADMIN'}
        coordinators={coordinators}
        selectedCoordinatorId={selectedCoordinatorId}
        onCoordinatorChange={setSelectedCoordinatorId}
      />

      <Card className="overflow-hidden rounded-xl border-[color:var(--accent-border)] bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--accent)]/80">Painel Principal</div>
              <div className="text-xl font-semibold text-[color:var(--accent)]">Orcado vs Realizado ({selectedYear})</div>
              <div className="text-xs text-muted-foreground">
                Barras para orcado e linhas para realizado, comparando ano atual e anterior.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  Orcado atual: {formatCompactMoney(chartTotals.orcadoAtual)}
                </Badge>
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  Realizado atual: {formatCompactMoney(chartTotals.realizadoAtual)}
                </Badge>
                <Badge
                  className={cn(
                    'border border-border/70 bg-[color:var(--surface-1)]',
                    (chartTotals.deltaAtual ?? 0) < 0 ? 'text-rose-500' : 'text-[color:var(--accent)]',
                  )}
                >
                  Delta: {formatCompactMoney(chartTotals.deltaAtual)}
                </Badge>
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  Aderencia: {formatPercent(chartTotals.aderenciaAtual)}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                Recorte: {visibleRangeLabel}
              </Badge>
              {summaryQuery.isFetching && <Skeleton className="h-4 w-24" />}
            </div>
          </div>

          <div className="h-[390px] rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/70 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="planning-bar-current" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.35} />
                  </linearGradient>
                  <linearGradient id="planning-bar-previous" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7caedb" stopOpacity={0.72} />
                    <stop offset="100%" stopColor="#7caedb" stopOpacity={0.28} />
                  </linearGradient>
                  <linearGradient id="planning-line-fill-current" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={rechartsTheme.gridStroke} vertical={false} strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke={rechartsTheme.referenceLineStroke} />
                <XAxis
                  dataKey="label"
                  tick={rechartsTheme.axisTick}
                  stroke={rechartsTheme.axisStroke}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={rechartsTheme.axisTick}
                  stroke={rechartsTheme.axisStroke}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCompactMoney(Number(value ?? 0))}
                />
                <RechartsTooltip
                  formatter={(value) => formatCurrencyBRL(Number(value ?? 0))}
                  contentStyle={rechartsTheme.tooltipContent}
                  labelStyle={rechartsTheme.tooltipLabel}
                  itemStyle={rechartsTheme.tooltipItem}
                />
                <Legend wrapperStyle={{ ...rechartsTheme.legend, paddingTop: 8 }} />

                <Bar
                  dataKey="orcadoAnoAtual"
                  name="Orcado Ano Atual"
                  fill="url(#planning-bar-current)"
                  stroke="var(--accent)"
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="orcadoAnoAnt"
                  name="Orcado Ano Anterior"
                  fill="url(#planning-bar-previous)"
                  stroke="#7caedb"
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Area
                  type="monotone"
                  dataKey="realizadoAnoAtual"
                  fill="url(#planning-line-fill-current)"
                  strokeOpacity={0}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="realizadoAnoAtual"
                  name="Realizado Ano Atual"
                  stroke="var(--accent)"
                  strokeWidth={2.8}
                  dot={{ r: 2.5, strokeWidth: 2, stroke: '#ffffff', fill: 'var(--accent)' }}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="realizadoAnoAnt"
                  name="Realizado Ano Anterior"
                  stroke="#4f89c2"
                  strokeWidth={2.4}
                  strokeDasharray="5 4"
                  dot={{ r: 2.2, strokeWidth: 1.5, stroke: '#ffffff', fill: '#4f89c2' }}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Categorias</div>
              <div className="text-xs text-muted-foreground">
                Selecione a Pró Ação para filtrar contas e indicadores de planejamento.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                {proacaoOptions.length} categorias
              </Badge>
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                Ativa: {activeProacaoLabel}
              </Badge>
              {isFetching && <Skeleton className="h-4 w-24" />}
            </div>
          </div>
          <CategoryTabs items={proacaoOptions} selectedId={selectedProacao} onSelect={setSelectedProacao} />

          {!hasProacoes && !proacoesQuery.isLoading && (
            <Card className="border-dashed border-border/60 bg-[color:var(--surface-1)]/70">
              <CardContent className="py-6 text-sm text-muted-foreground">
                Nenhuma Pró Ação disponível para seu usuário. Verifique os vínculos no Admin.
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Tabela mensal</div>
              <div className="text-xs text-muted-foreground">
                Edite valores por conta e mês. Recorte atual: <span className="font-medium">{visibleRangeLabel}</span>.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  {filteredAccounts.length} contas no recorte
                </Badge>
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  Coluna conta: {accountColumnWidth}px
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-border/70 bg-[color:var(--surface-1)]"
                onClick={handleRunAudit}
                disabled={!selectedProacao || auditQuery.isFetching}
              >
                {auditQuery.isFetching ? 'Varrendo...' : 'Varredura DRE'}
              </Button>
              {showAuditPanel && auditQuery.data && (
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  {auditQuery.data.summary.totalIssues} inconsistencias
                </Badge>
              )}
              {user?.role === 'COORDINATOR' && (
                <Button
                  size="sm"
                  className="border border-[color:var(--accent-border)] bg-[color:var(--accent-2)] text-white hover:bg-[color:var(--accent)]"
                  onClick={handleFinalize}
                  disabled={isFinalizing || hasLockedCells || !grid}
                >
                  {isFinalizing ? 'Salvando...' : hasLockedCells ? 'Planejamento salvo' : 'Salvar'}
                </Button>
              )}
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-[color:var(--surface-1)] px-3 py-1.5 text-xs text-muted-foreground">
                <span>Largura da conta</span>
                <input
                  type="range"
                  min={180}
                  max={560}
                  step={10}
                  value={accountColumnWidth}
                  onChange={(event) => setAccountColumnWidth(Number(event.target.value))}
                  className="h-1.5 w-28"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="w-12 text-right tabular-nums">{accountColumnWidth}px</span>
              </div>
              {isFetching && <Skeleton className="h-4 w-24" />}
            </div>
          </CardContent>
        </Card>
        {isFetching && !grid ? (
          <Card className="border-border/60 bg-[color:var(--surface-2)]/60">
            <CardContent className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={`row-${index}`} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
      <BudgetTable
        accounts={filteredAccounts}
        visibleMonths={visibleMonths}
        year={selectedYear}
        valuesByAccount={valuesByAccount}
        lockedByAccount={lockedByAccount}
        draftByCell={draftByCell}
        statusMap={statusMap}
        invert={invert}
        canEditLocked={user?.role === 'ADMIN'}
        onValueChange={handleValueChange}
            onValueBlur={handleValueBlur}
            onRowClick={(accountId) => setDetailAccountId(accountId)}
            accountColumnWidth={accountColumnWidth}
            onAccountColumnWidthChange={setAccountColumnWidth}
          />
        )}
      </div>

      {showAuditPanel && (
        <Card className="rounded-2xl border-[color:var(--accent-border)] bg-[color:var(--surface-1)]">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Auditoria DRE x Contas por Coordenador</div>
                <div className="text-xs text-muted-foreground">
                  Cruzamento automatico entre valores do planejamento e o DRE do ano vigente.
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowAuditPanel(false)}>
                Fechar
              </Button>
            </div>

            {auditQuery.isFetching ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : auditQuery.data ? (
              <>
                <div className="grid gap-2 md:grid-cols-4">
                  <Card className="border-border/70 bg-[color:var(--surface-1)]/90">
                    <CardContent className="p-3">
                      <div className="text-xs uppercase text-muted-foreground">Total</div>
                      <div className="text-xl font-semibold tabular-nums">{auditQuery.data.summary.totalIssues}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-rose-400/40 bg-rose-500/5">
                    <CardContent className="p-3">
                      <div className="text-xs uppercase text-muted-foreground">Criticas</div>
                      <div className="text-xl font-semibold tabular-nums text-rose-500">{auditQuery.data.summary.high}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-300/60 bg-amber-50/65">
                    <CardContent className="p-3">
                      <div className="text-xs uppercase text-muted-foreground">Medias</div>
                      <div className="text-xl font-semibold tabular-nums text-amber-600">{auditQuery.data.summary.medium}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]">
                    <CardContent className="p-3">
                      <div className="text-xs uppercase text-muted-foreground">Editaveis</div>
                      <div className="text-xl font-semibold tabular-nums text-[color:var(--accent)]">{auditQuery.data.summary.editable}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="max-h-[360px] overflow-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[color:var(--surface-2)]">
                      <tr>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Conta</th>
                        <th className="px-3 py-2 text-right">Mes</th>
                        <th className="px-3 py-2 text-right">Planejamento</th>
                        <th className="px-3 py-2 text-right">DRE</th>
                        <th className="px-3 py-2 text-right">Delta</th>
                        <th className="px-3 py-2 text-right">Ajuste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQuery.data.issues.length === 0 ? (
                        <tr className="border-t border-border/60">
                          <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                            Sem inconsistencias.
                          </td>
                        </tr>
                      ) : (
                        auditQuery.data.issues.map((issue) => (
                          <tr key={issue.id} className="border-t border-border/40">
                            <td className="px-3 py-2">
                              <Badge
                                className={cn(
                                  'border',
                                  issue.severity === 'high'
                                    ? 'border-rose-400/40 bg-rose-400/10 text-rose-500'
                                    : 'border-amber-400/40 bg-amber-400/10 text-amber-300',
                                )}
                              >
                                {issue.type}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{issue.accountLabel ?? '-'}</div>
                              <div className="text-xs text-muted-foreground">{issue.accountCode ?? '-'}</div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {issue.month ? formatMonthLabel(issue.month, selectedYear) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrencyBRL(issue.planningValue ?? 0)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrencyBRL(issue.dreValue ?? 0)}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2 text-right tabular-nums',
                                (issue.delta ?? 0) < 0 ? 'text-rose-500' : 'text-[color:var(--accent)]',
                              )}
                            >
                              {formatCurrencyBRL(issue.delta ?? 0)}
                            </td>
                            <td className="px-3 py-2">
                              {issue.canEdit && issue.accountId && issue.month ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    inputMode="numeric"
                                    value={auditDraftByIssue[issue.id] ?? String(Math.trunc(issue.planningValue ?? 0))}
                                    onChange={(event) =>
                                      setAuditDraftByIssue((prev) => ({ ...prev, [issue.id]: event.target.value }))
                                    }
                                    className="h-8 w-28 text-right"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleApplyAuditFix(issue)}
                                    disabled={Boolean(auditSavingByIssue[issue.id])}
                                  >
                                    {auditSavingByIssue[issue.id] ? 'Salvando...' : 'Aplicar'}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Somente leitura</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Clique em &quot;Varredura DRE&quot; para iniciar.</div>
            )}
          </CardContent>
        </Card>
      )}

      <AccountDetailDrawer
        open={Boolean(detailAccountId)}
        onOpenChange={(open) => !open && setDetailAccountId(null)}
        account={selectedAccount}
        year={selectedYear}
        invert={invert}
      />
    </div>
  );
}

