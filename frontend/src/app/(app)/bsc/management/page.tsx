'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { BscNav } from '@/features/bsc/bsc-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ManagementGrid } from '@/components/bsc/ManagementGrid';
import { LoadingState } from '@/components/bsc/LoadingState';
import { ErrorState } from '@/components/bsc/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import type { ComponentType } from 'react';
import {
  AlertTriangle,
  Filter,
  Layers3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'pt-BR'),
  );
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
      <CardContent className="relative space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="text-[30px] font-semibold leading-none text-foreground tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

export default function BscManagementPage() {
  const { apiFetch } = useApiClient();
  const { user } = useAuth();
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');
  const [perspective, setPerspective] = useState('ALL');
  const [level, setLevel] = useState('ALL');
  const [process, setProcess] = useState('ALL');
  const [responsible, setResponsible] = useState('ALL');
  const [dataOwner, setDataOwner] = useState('ALL');
  const [keyword, setKeyword] = useState('ALL');

  const managementQuery = useQuery({
    queryKey: ['bsc-management', year],
    queryFn: () => backend.getBscManagement(apiFetch, year),
  });

  const summaryQuery = useQuery({
    queryKey: ['bsc-management-summary', year],
    queryFn: () => backend.getBscManagementSummary(apiFetch, year),
  });

  const saveActualMutation = useMutation({
    mutationFn: ({
      code,
      payload,
    }: {
      code: string;
      payload: { year: number; month: number; actualValue: number | null };
    }) => backend.setBscIndicatorMonthActual(apiFetch, code, payload),
    onSuccess: async () => {
      await managementQuery.refetch();
      await summaryQuery.refetch();
      toast.success('Realizado atualizado.');
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Falha ao salvar realizado.');
    },
  });

  const allRows = useMemo(() => managementQuery.data?.rows ?? [], [managementQuery.data?.rows]);

  const filterOptions = useMemo(
    () => ({
      perspectives: uniqueSorted(allRows.map((row) => row.perspective)),
      levels: uniqueSorted(allRows.map((row) => (row.level == null ? null : String(row.level)))),
      processes: uniqueSorted(allRows.map((row) => row.process)),
      responsibles: uniqueSorted(allRows.map((row) => row.responsible)),
      dataOwners: uniqueSorted(allRows.map((row) => row.dataOwner)),
      keywords: uniqueSorted(
        allRows.flatMap((row) =>
          String(row.keywords ?? '')
            .split(/[;,/|]/)
            .map((part) => part.trim())
            .filter(Boolean),
        ),
      ),
    }),
    [allRows],
  );

  const rows = useMemo(() => {
    const target = search.trim().toLowerCase();
    return allRows.filter((row) => {
      const keywordMatch =
        keyword === 'ALL' ||
        String(row.keywords ?? '')
          .toLowerCase()
          .split(/[;,/|]/)
          .map((part) => part.trim())
          .includes(keyword.toLowerCase());
      return (
        (perspective === 'ALL' || row.perspective === perspective) &&
        (level === 'ALL' || String(row.level ?? '') === level) &&
        (process === 'ALL' || row.process === process) &&
        (responsible === 'ALL' || row.responsible === responsible) &&
        (dataOwner === 'ALL' || row.dataOwner === dataOwner) &&
        keywordMatch &&
        (!target ||
          row.code.toLowerCase().includes(target) ||
          row.name.toLowerCase().includes(target) ||
          row.objective.toLowerCase().includes(target))
      );
    });
  }, [allRows, search, perspective, level, process, responsible, dataOwner, keyword]);

  const canEditActual = user?.role === 'ADMIN' || user?.role === 'CONTROLLER';

  const activeFiltersCount = useMemo(() => {
    const valueFilters = [perspective, level, process, responsible, dataOwner, keyword].filter((value) => value !== 'ALL')
      .length;
    return valueFilters + (search.trim() ? 1 : 0);
  }, [perspective, level, process, responsible, dataOwner, keyword, search]);

  const stats = useMemo(() => {
    let totalCells = 0;
    let targetCells = 0;
    let actualCells = 0;
    let green = 0;
    let yellow = 0;
    let red = 0;
    let noData = 0;

    rows.forEach((row) => {
      row.months.forEach((month) => {
        totalCells += 1;
        if (month.target != null) targetCells += 1;
        if (month.actual != null) actualCells += 1;
        const status = String(month.status ?? '').toUpperCase();
        if (status === 'GREEN' || status === 'VERDE') green += 1;
        else if (status === 'YELLOW' || status === 'AMARELO') yellow += 1;
        else if (status === 'RED' || status === 'VERMELHO') red += 1;
        else noData += 1;
      });
    });

    const actualRate = totalCells === 0 ? 0 : (actualCells / totalCells) * 100;
    const targetRate = totalCells === 0 ? 0 : (targetCells / totalCells) * 100;

    return {
      indicatorCount: rows.length,
      actualRate,
      targetRate,
      green,
      yellow,
      red,
      noData,
    };
  }, [rows]);

  const highlightGroups = useMemo(() => (summaryQuery.data?.grouped ?? []).slice(0, 4), [summaryQuery.data?.grouped]);

  const clearFilters = () => {
    setSearch('');
    setPerspective('ALL');
    setLevel('ALL');
    setProcess('ALL');
    setResponsible('ALL');
    setDataOwner('ALL');
    setKeyword('ALL');
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Gestao Mensal BSC
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">Mapa Estrategico - Gestao</h1>
                <p className="text-sm text-muted-foreground">
                  Meta projetada por mes, realizado manual e diferenca de desempenho.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  Filtros ativos: {activeFiltersCount}
                </Badge>
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  Ano: {year}
                </Badge>
              </div>
            </div>
            <BscNav />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Target}
              title="Indicadores"
              value={String(stats.indicatorCount)}
              subtitle="Itens no recorte atual"
            />
            <MetricCard
              icon={Layers3}
              title="Cobertura Meta"
              value={formatPercent(stats.targetRate)}
              subtitle="Meses com meta preenchida"
            />
            <MetricCard
              icon={Users}
              title="Cobertura Realizado"
              value={formatPercent(stats.actualRate)}
              subtitle="Meses com realizado informado"
            />
            <MetricCard
              icon={AlertTriangle}
              title="Alertas"
              value={String(stats.yellow + stats.red + stats.noData)}
              subtitle={`Atencao ${stats.yellow} | Faltou ${stats.red} | Sem dado ${stats.noData}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm text-[color:var(--accent)]">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                {rows.length} indicadores no recorte
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="rounded-full border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:bg-[color:var(--surface-2)] hover:text-foreground"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={perspective} onValueChange={setPerspective}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Perspectiva" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as perspectivas</SelectItem>
              {filterOptions.perspectives.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os niveis</SelectItem>
              {filterOptions.levels.map((value) => (
                <SelectItem key={value} value={value}>
                  Nivel {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 border-border/70 bg-[color:var(--surface-1)] pl-9 shadow-sm"
              placeholder="Buscar codigo/nome/objetivo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={process} onValueChange={setProcess}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Processo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os processos</SelectItem>
              {filterOptions.processes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsible} onValueChange={setResponsible}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Responsavel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os responsaveis</SelectItem>
              {filterOptions.responsibles.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dataOwner} onValueChange={setDataOwner}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Alimentador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os alimentadores</SelectItem>
              {filterOptions.dataOwners.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={keyword} onValueChange={setKeyword}>
            <SelectTrigger className="h-10 border-border/70 bg-[color:var(--surface-1)] shadow-sm">
              <SelectValue placeholder="Palavra-chave" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as palavras-chave</SelectItem>
              {filterOptions.keywords.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-[color:var(--accent)]">Destaques por objetivo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {highlightGroups.map((group: any, index: number) => {
            const green = Number(group?.verde ?? group?.green ?? 0);
            const yellow = Number(group?.amarelo ?? group?.yellow ?? 0);
            const red = Number(group?.vermelho ?? group?.red ?? 0);
            const noData = Number(group?.semDados ?? group?.noData ?? 0);
            return (
              <Card
                key={`${group?.perspective ?? 'perspective'}-${group?.objective ?? 'objective'}-${index}`}
                className="rounded-2xl border-border/70 bg-[color:var(--surface-1)]/95 shadow-sm"
              >
                <CardContent className="space-y-2 p-3">
                  <div className="line-clamp-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {group?.perspective ?? 'Sem perspectiva'}
                  </div>
                  <div className="line-clamp-2 text-sm font-semibold text-foreground">{group?.objective ?? 'Sem objetivo'}</div>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">Passou {green}</Badge>
                    <Badge className="border border-amber-300/70 bg-amber-100/80 text-amber-700">Atencao {yellow}</Badge>
                    <Badge className="border border-rose-300/70 bg-rose-100/80 text-rose-600">Faltou {red}</Badge>
                    <Badge className="border border-border/70 bg-[color:var(--surface-2)] text-muted-foreground">Sem dado {noData}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {highlightGroups.length === 0 && !summaryQuery.isLoading ? (
            <div className="col-span-full rounded-2xl border border-border/70 bg-[color:var(--surface-1)] px-4 py-6 text-sm text-muted-foreground">
              Sem dados de resumo para o ano selecionado.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {managementQuery.isLoading ? <LoadingState label="Carregando gestao mensal..." /> : null}
      {managementQuery.isError ? <ErrorState label="Falha ao carregar a gestao mensal." /> : null}

      {!managementQuery.isLoading && !managementQuery.isError ? (
        <Card className="rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
          <CardHeader className="border-b border-border/70 bg-[color:var(--surface-2)]/75 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold text-foreground">Grade mensal de metas e realizado</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">Passou {stats.green}</Badge>
                <Badge className="border border-amber-300/70 bg-amber-100/80 text-amber-700">Atencao {stats.yellow}</Badge>
                <Badge className="border border-rose-300/70 bg-rose-100/80 text-rose-600">Faltou {stats.red}</Badge>
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">Sem dado {stats.noData}</Badge>
                <Badge
                  className={cn(
                    'border px-2 py-0 text-[10px] uppercase tracking-wide',
                    canEditActual
                      ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                      : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground',
                  )}
                >
                  {canEditActual ? 'Edicao ativa' : 'Somente leitura'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ManagementGrid
              year={year}
              rows={rows}
              editable={canEditActual}
              saving={saveActualMutation.isPending}
              onSaveActual={(code, payload) => saveActualMutation.mutateAsync({ code, payload })}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

