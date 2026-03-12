'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { BscNav } from '@/features/bsc/bsc-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/bsc/LoadingState';
import { ErrorState } from '@/components/bsc/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { rechartsTheme } from '@/lib/recharts-theme';
import { AlertTriangle, Filter, Layers3, Pencil, Search, SlidersHorizontal, Sparkles, Target, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'pt-BR'),
  );
}

function formatMetricValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeCodeKey(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function normalizeBscStatus(value: unknown) {
  const status = String(value ?? '').toUpperCase();
  if (status === 'GREEN' || status === 'VERDE') return 'GREEN';
  if (status === 'YELLOW' || status === 'AMARELO') return 'YELLOW';
  if (status === 'RED' || status === 'VERMELHO') return 'RED';
  return 'NO_DATA';
}

function shortPerspectiveLabel(value: string) {
  if (value === 'FINANCEIRO') return 'FIN';
  if (value === 'CLIENTE') return 'CLI';
  if (value === 'PROCESSOS') return 'PROC';
  if (value === 'APRENDIZADO_CRESCIMENTO') return 'APR';
  return value.slice(0, 3).toUpperCase();
}

const PERSPECTIVE_ORDER = ['FINANCEIRO', 'CLIENTE', 'PROCESSOS', 'APRENDIZADO_CRESCIMENTO'];

const PERSPECTIVE_CONFIG: Record<
  string,
  {
    label: string;
    sectionBg: string;
    sectionBorder: string;
    sectionText: string;
    countBadge: string;
    codeBadge: string;
    objectiveBg: string;
  }
> = {
  FINANCEIRO: {
    label: 'FINANCEIRO',
    sectionBg: 'bg-[#edf5ff] dark:bg-[#13243a]',
    sectionBorder: 'border-[#c0d8f3] dark:border-[#2b4563]',
    sectionText: 'text-[#1f5d96] dark:text-[#93c2ee]',
    countBadge: 'border-[#a8c9ec] bg-[#dfeeff] text-[#1f5d96] dark:border-[#3e5e82] dark:bg-[#1b3350] dark:text-[#9dcaf3]',
    codeBadge: 'border-[#9fc3e9] bg-[#e9f4ff] text-[#2b659f] dark:border-[#3b5b7f] dark:bg-[#1a304a] dark:text-[#9ac7f0]',
    objectiveBg: 'bg-[#f7fbff] dark:bg-[#0f2033]',
  },
  CLIENTE: {
    label: 'CLIENTE',
    sectionBg: 'bg-[#ecf6ff] dark:bg-[#13233a]',
    sectionBorder: 'border-[#bbd7f3] dark:border-[#2c4463]',
    sectionText: 'text-[#215f98] dark:text-[#93c2ee]',
    countBadge: 'border-[#9bc2ea] bg-[#d9ecff] text-[#215f98] dark:border-[#3e5e82] dark:bg-[#1b3350] dark:text-[#9dcaf3]',
    codeBadge: 'border-[#9bc2ea] bg-[#e8f4ff] text-[#2b659f] dark:border-[#3b5b7f] dark:bg-[#1a304a] dark:text-[#9ac7f0]',
    objectiveBg: 'bg-[#f7fbff] dark:bg-[#0f2033]',
  },
  PROCESSOS: {
    label: 'PROCESSOS',
    sectionBg: 'bg-[#eef5ff] dark:bg-[#15253c]',
    sectionBorder: 'border-[#bfd5ef] dark:border-[#2f4867]',
    sectionText: 'text-[#2f6fa9] dark:text-[#9ac9f4]',
    countBadge: 'border-[#a6c4e9] bg-[#e2efff] text-[#2f6fa9] dark:border-[#436488] dark:bg-[#1d3653] dark:text-[#a4d0f8]',
    codeBadge: 'border-[#9fc1e6] bg-[#e8f3ff] text-[#2d699e] dark:border-[#406184] dark:bg-[#1c324d] dark:text-[#9fcdf6]',
    objectiveBg: 'bg-[#f8fbff] dark:bg-[#112236]',
  },
  APRENDIZADO_CRESCIMENTO: {
    label: 'APRENDIZADO E CRESCIMENTO',
    sectionBg: 'bg-[#f0f6ff] dark:bg-[#16263d]',
    sectionBorder: 'border-[#c3d8f1] dark:border-[#304a69]',
    sectionText: 'text-[#356fa3] dark:text-[#9fcaf1]',
    countBadge: 'border-[#a8c5e8] bg-[#e4efff] text-[#356fa3] dark:border-[#466689] dark:bg-[#1f3754] dark:text-[#a8d2f7]',
    codeBadge: 'border-[#a2c2e7] bg-[#ebf4ff] text-[#2f6798] dark:border-[#426284] dark:bg-[#1d324e] dark:text-[#a2cdf3]',
    objectiveBg: 'bg-[#f8fbff] dark:bg-[#122338]',
  },
};

interface GroupedObjective {
  objectiveName: string;
  indicators: any[];
}

interface GroupedPerspective {
  perspectiveName: string;
  objectives: GroupedObjective[];
  totalIndicators: number;
}

function FilterChipGroup({
  title,
  value,
  onChange,
  options,
  allLabel,
  formatOption,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
  allLabel: string;
  formatOption?: (option: string) => string;
}) {
  const renderLabel = (option: string) => (formatOption ? formatOption(option) : option);

  return (
    <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        <Badge className="border border-border/70 bg-[color:var(--surface-1)] px-2 py-0 text-[10px] text-muted-foreground">
          {options.length}
        </Badge>
      </div>
      <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => onChange('ALL')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
            value === 'ALL'
              ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
              : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)]',
          )}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              value === option
                ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)]',
            )}
          >
            {renderLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryKpi({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
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

export default function BscMapPage() {
  const { apiFetch } = useApiClient();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(2026);
  const [perspective, setPerspective] = useState('ALL');
  const [level, setLevel] = useState('ALL');
  const [process, setProcess] = useState('ALL');
  const [responsible, setResponsible] = useState('ALL');
  const [dataOwner, setDataOwner] = useState('ALL');
  const [keyword, setKeyword] = useState('ALL');
  const [onlyBelowExpected, setOnlyBelowExpected] = useState(false);

  const indicatorsQuery = useQuery({
    queryKey: ['bsc-indicators-map'],
    queryFn: () => backend.getBscIndicators(apiFetch),
  });

  const managementQuery = useQuery({
    queryKey: ['bsc-management-map', year],
    queryFn: () => backend.getBscManagement(apiFetch, year),
  });

  const indicators = useMemo(() => indicatorsQuery.data ?? [], [indicatorsQuery.data]);

  const yearOptions = useMemo(() => {
    const indicatorYears = indicators.flatMap((indicator: any) =>
      (indicator.yearTargets ?? []).map((target: any) => Number(target.year)),
    );
    const values = new Set<number>([...indicatorYears, new Date().getFullYear()]);
    return Array.from(values).filter((value) => Number.isFinite(value)).sort((a, b) => b - a);
  }, [indicators]);

  const managementRows = useMemo(() => managementQuery.data?.rows ?? [], [managementQuery.data?.rows]);

  const managementByIndicatorId = useMemo(
    () => new Map(managementRows.map((row) => [String(row.indicatorId ?? ''), row] as const)),
    [managementRows],
  );

  const managementByCode = useMemo(
    () => new Map(managementRows.map((row) => [normalizeCodeKey(String(row.code ?? '')), row] as const)),
    [managementRows],
  );

  const filterOptions = useMemo(
    () => ({
      perspectives: uniqueSorted(indicators.map((row: any) => row.objective?.perspective?.name ?? null)),
      levels: uniqueSorted(indicators.map((row: any) => (row.level == null ? null : String(row.level)))),
      processes: uniqueSorted(indicators.map((row: any) => row.process)),
      responsibles: uniqueSorted(indicators.map((row: any) => row.responsible)),
      dataOwners: uniqueSorted(indicators.map((row: any) => row.dataOwner)),
      keywords: uniqueSorted(
        indicators.flatMap((row: any) =>
          String(row.keywords ?? '')
            .split(/[;,/|]/)
            .map((part: string) => part.trim())
            .filter(Boolean),
        ),
      ),
    }),
    [indicators],
  );

  const isBelowExpected = (row: any) => {
    const management =
      managementByIndicatorId.get(String(row.id ?? '')) ??
      managementByCode.get(normalizeCodeKey(String(row.code ?? '')));
    const latestMonth = [...(management?.months ?? [])]
      .reverse()
      .find((monthItem: any) => monthItem.target != null || monthItem.actual != null);
    const status = String(latestMonth?.status ?? '').toUpperCase();
    return status === 'YELLOW' || status === 'AMARELO' || status === 'RED' || status === 'VERMELHO';
  };

  const baseFilteredRows = useMemo(() => {
    const target = search.trim().toLowerCase();
    return indicators.filter((row: any) => {
      const rowPerspective = row.objective?.perspective?.name ?? '';
      const keywordMatch =
        keyword === 'ALL' ||
        String(row.keywords ?? '')
          .toLowerCase()
          .split(/[;,/|]/)
          .map((part: string) => part.trim())
          .includes(keyword.toLowerCase());
      return (
        (perspective === 'ALL' || rowPerspective === perspective) &&
        (level === 'ALL' || String(row.level ?? '') === level) &&
        (process === 'ALL' || row.process === process) &&
        (responsible === 'ALL' || row.responsible === responsible) &&
        (dataOwner === 'ALL' || row.dataOwner === dataOwner) &&
        keywordMatch &&
        (!target ||
          String(row.code ?? '').toLowerCase().includes(target) ||
          String(row.name ?? '').toLowerCase().includes(target) ||
          String(row.objective?.name ?? '').toLowerCase().includes(target))
      );
    });
  }, [indicators, search, perspective, level, process, responsible, dataOwner, keyword]);

  const belowExpectedCount = useMemo(
    () => baseFilteredRows.filter((row: any) => isBelowExpected(row)).length,
    [baseFilteredRows, managementByIndicatorId, managementByCode],
  );

  const filteredRows = useMemo(() => {
    if (!onlyBelowExpected) return baseFilteredRows;
    return baseFilteredRows.filter((row: any) => isBelowExpected(row));
  }, [baseFilteredRows, onlyBelowExpected, managementByIndicatorId, managementByCode]);

  const grouped = useMemo<GroupedPerspective[]>(() => {
    const perspectiveMap = new Map<string, Map<string, any[]>>();
    for (const row of filteredRows as any[]) {
      const perspectiveName = row.objective?.perspective?.name ?? 'OUTROS';
      const objectiveName = row.objective?.name ?? 'Sem objetivo';
      if (!perspectiveMap.has(perspectiveName)) perspectiveMap.set(perspectiveName, new Map());
      const objectiveMap = perspectiveMap.get(perspectiveName)!;
      if (!objectiveMap.has(objectiveName)) objectiveMap.set(objectiveName, []);
      objectiveMap.get(objectiveName)!.push(row);
    }

    const sortedKeys = Array.from(perspectiveMap.keys()).sort((left, right) => {
      const leftIndex = PERSPECTIVE_ORDER.indexOf(left);
      const rightIndex = PERSPECTIVE_ORDER.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });

    return sortedKeys.map((perspectiveName) => {
      const objectiveMap = perspectiveMap.get(perspectiveName)!;
      const objectives = Array.from(objectiveMap.entries()).map(([objectiveName, indicatorsList]) => ({
        objectiveName,
        indicators: indicatorsList,
      }));
      return {
        perspectiveName,
        objectives,
        totalIndicators: objectives.reduce((sum, objective) => sum + objective.indicators.length, 0),
      };
    });
  }, [filteredRows]);

  const activeFiltersCount = useMemo(() => {
    const valueFilters =
      [perspective, level, process, responsible, dataOwner, keyword].filter((value) => value !== 'ALL').length +
      (onlyBelowExpected ? 1 : 0);
    return valueFilters + (search.trim() ? 1 : 0);
  }, [perspective, level, process, responsible, dataOwner, keyword, search, onlyBelowExpected]);

  const indicatorsWithTargetInYear = useMemo(
    () =>
      filteredRows.filter((row: any) =>
        (row.yearTargets ?? []).some((target: any) => target.year === year && target.targetValue != null),
      ).length,
    [filteredRows, year],
  );
  const targetCoverage = filteredRows.length === 0 ? 0 : (indicatorsWithTargetInYear / filteredRows.length) * 100;

  const totalObjectives = useMemo(
    () => grouped.reduce((sum, perspectiveGroup) => sum + perspectiveGroup.objectives.length, 0),
    [grouped],
  );

  const uniqueResponsibles = useMemo(
    () => uniqueSorted(filteredRows.map((row: any) => row.responsible)).length,
    [filteredRows],
  );

  const chartInsights = useMemo(() => {
    const byPerspective = new Map<
      string,
      {
        perspective: string;
        indicators: number;
        attainmentSum: number;
        attainmentCount: number;
        green: number;
        yellow: number;
        red: number;
        noData: number;
      }
    >();

    const topVarianceDataRaw: Array<{
      code: string;
      name: string;
      perspective: string;
      variancePct: number;
    }> = [];

    filteredRows.forEach((row: any) => {
      const perspectiveName = String(row.objective?.perspective?.name ?? 'OUTROS');
      const management =
        managementByIndicatorId.get(String(row.id ?? '')) ??
        managementByCode.get(normalizeCodeKey(String(row.code ?? '')));
      const months = management?.months ?? [];
      const latestMonth = [...months]
        .reverse()
        .find((monthItem: any) => monthItem.target != null || monthItem.actual != null);
      const normalizedStatus = normalizeBscStatus(latestMonth?.status);
      const target = Number(latestMonth?.target ?? 0);
      const actual = Number(latestMonth?.actual ?? 0);
      const attainmentRaw = Number(latestMonth?.attainment ?? NaN);
      const attainmentPct = Number.isFinite(attainmentRaw) ? attainmentRaw * 100 : null;
      const variancePct = target !== 0 ? ((actual - target) / Math.abs(target)) * 100 : null;

      if (!byPerspective.has(perspectiveName)) {
        byPerspective.set(perspectiveName, {
          perspective: perspectiveName,
          indicators: 0,
          attainmentSum: 0,
          attainmentCount: 0,
          green: 0,
          yellow: 0,
          red: 0,
          noData: 0,
        });
      }
      const bucket = byPerspective.get(perspectiveName)!;
      bucket.indicators += 1;
      if (attainmentPct != null && Number.isFinite(attainmentPct)) {
        bucket.attainmentSum += attainmentPct;
        bucket.attainmentCount += 1;
      }
      if (normalizedStatus === 'GREEN') bucket.green += 1;
      else if (normalizedStatus === 'YELLOW') bucket.yellow += 1;
      else if (normalizedStatus === 'RED') bucket.red += 1;
      else bucket.noData += 1;

      if (variancePct != null && Number.isFinite(variancePct)) {
        topVarianceDataRaw.push({
          code: String(row.code ?? ''),
          name: String(row.name ?? ''),
          perspective: perspectiveName,
          variancePct: Number(variancePct.toFixed(2)),
        });
      }
    });

    const perspectiveRows = Array.from(byPerspective.values()).sort((left, right) => {
      const leftIndex = PERSPECTIVE_ORDER.indexOf(left.perspective);
      const rightIndex = PERSPECTIVE_ORDER.indexOf(right.perspective);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });

    const performanceData = perspectiveRows.map((item) => {
      const attainment =
        item.attainmentCount > 0 ? Number((item.attainmentSum / item.attainmentCount).toFixed(1)) : 0;
      return {
        perspective: shortPerspectiveLabel(item.perspective),
        perspectiveName: item.perspective,
        target: 100,
        attainment,
      };
    });

    const statusData = perspectiveRows.map((item) => ({
      perspective: shortPerspectiveLabel(item.perspective),
      perspectiveName: item.perspective,
      green: item.green,
      yellow: item.yellow,
      red: item.red,
      noData: item.noData,
    }));

    const statusTotals = perspectiveRows.reduce(
      (acc, item) => {
        acc.green += item.green;
        acc.yellow += item.yellow;
        acc.red += item.red;
        acc.noData += item.noData;
        return acc;
      },
      { green: 0, yellow: 0, red: 0, noData: 0 },
    );

    const topVarianceData = topVarianceDataRaw
      .sort((left, right) => Math.abs(right.variancePct) - Math.abs(left.variancePct))
      .slice(0, 8)
      .sort((left, right) => left.variancePct - right.variancePct)
      .map((item) => ({
        ...item,
        label: item.code,
      }));

    return {
      performanceData,
      statusData,
      topVarianceData,
      statusTotals,
    };
  }, [filteredRows, managementByIndicatorId, managementByCode]);

  const clearFilters = () => {
    setSearch('');
    setPerspective('ALL');
    setLevel('ALL');
    setProcess('ALL');
    setResponsible('ALL');
    setDataOwner('ALL');
    setKeyword('ALL');
    setOnlyBelowExpected(false);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Mapa Estrategico BSC
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
                  Mapa Estrategico - Plano de Metas e Indicadores
                </h1>
                <p className="text-sm text-muted-foreground">
                  Visualizacao completa do BSC por perspectiva, objetivo, responsavel e processo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                  Filtros ativos: {activeFiltersCount}
                </Badge>
                <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  Ano de referencia: {year}
                </Badge>
              </div>
            </div>
            <BscNav />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryKpi
              icon={Target}
              title="Indicadores"
              value={String(filteredRows.length)}
              subtitle="Itens no recorte atual"
            />
            <SummaryKpi
              icon={Layers3}
              title="Objetivos"
              value={String(totalObjectives)}
              subtitle={`${grouped.length} perspectivas visiveis`}
            />
            <SummaryKpi
              icon={Users}
              title="Responsaveis"
              value={String(uniqueResponsibles)}
              subtitle="Pessoas com indicadores no recorte"
            />
            <SummaryKpi
              icon={Filter}
              title={`Cobertura ${year}`}
              value={formatPercent(targetCoverage)}
              subtitle={`${indicatorsWithTargetInYear} indicadores com meta do ano`}
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
                {filteredRows.length} indicadores no recorte
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
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3 shadow-inner shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filtro rapido</div>
                <div className="text-xs text-muted-foreground">
                  Destaque visual para metas com status abaixo do esperado no ultimo mes com dado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnlyBelowExpected((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  onlyBelowExpected
                    ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                    : 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15',
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {onlyBelowExpected ? 'Mostrando abaixo do esperado' : 'Filtrar abaixo do esperado'}
                <span className="rounded-full border border-current/40 px-2 py-0.5 text-[10px]">{belowExpectedCount}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3 shadow-inner shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ano</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {yearOptions.map((optionYear) => (
                  <button
                    key={optionYear}
                    type="button"
                    onClick={() => setYear(optionYear)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      year === optionYear
                        ? 'border-[color:var(--accent-border)] bg-[color:var(--accent)] text-white'
                        : 'border-border/70 bg-[color:var(--surface-1)] text-muted-foreground hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)]',
                    )}
                  >
                    {optionYear}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3 shadow-inner shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Busca</div>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 border-border/70 bg-[color:var(--surface-1)] pl-9 pr-9 shadow-sm"
                  placeholder="Buscar codigo/nome/objetivo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border/70 bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FilterChipGroup
              title="Perspectiva"
              value={perspective}
              onChange={setPerspective}
              options={filterOptions.perspectives}
              allLabel="Todas"
              formatOption={(option) => PERSPECTIVE_CONFIG[option]?.label ?? option}
            />
            <FilterChipGroup
              title="Nivel"
              value={level}
              onChange={setLevel}
              options={filterOptions.levels}
              allLabel="Todos"
              formatOption={(option) => `Nivel ${option}`}
            />
            <FilterChipGroup
              title="Processo"
              value={process}
              onChange={setProcess}
              options={filterOptions.processes}
              allLabel="Todos"
            />
            <FilterChipGroup
              title="Responsavel"
              value={responsible}
              onChange={setResponsible}
              options={filterOptions.responsibles}
              allLabel="Todos"
            />
            <FilterChipGroup
              title="Alimentador"
              value={dataOwner}
              onChange={setDataOwner}
              options={filterOptions.dataOwners}
              allLabel="Todos"
            />
            <FilterChipGroup
              title="Palavra-chave"
              value={keyword}
              onChange={setKeyword}
              options={filterOptions.keywords}
              allLabel="Todas"
            />
          </div>
        </CardContent>
      </Card>

      {indicatorsQuery.isLoading ? <LoadingState label="Carregando mapa..." /> : null}
      {indicatorsQuery.isError ? <ErrorState label="Falha ao carregar indicadores do mapa." /> : null}

      {!indicatorsQuery.isLoading && !indicatorsQuery.isError ? (
        <>
          <Card className="rounded-2xl border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] shadow-sm">
            <CardContent className="flex items-center gap-2 px-4 py-3">
              <Pencil className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
              <span className="text-sm text-[color:var(--accent)]">
                Clique no botao <span className="font-semibold">Editar</span> de cada indicador para abrir a tela de edicao com Meta, Realizado e grafico, igual a planilha Excel.
              </span>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
            <CardHeader className="border-b border-border/70 bg-[color:var(--surface-2)]/70 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Visao Grafica BSC</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="border border-emerald-400/50 bg-emerald-500/10 text-emerald-300">
                    Verde: {chartInsights.statusTotals.green}
                  </Badge>
                  <Badge className="border border-amber-400/50 bg-amber-500/10 text-amber-300">
                    Amarelo: {chartInsights.statusTotals.yellow}
                  </Badge>
                  <Badge className="border border-rose-400/50 bg-rose-500/10 text-rose-300">
                    Vermelho: {chartInsights.statusTotals.red}
                  </Badge>
                  <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                    Sem dados: {chartInsights.statusTotals.noData}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3">
                <div className="mb-1 text-sm font-semibold text-foreground">Atingimento Medio (ultimo fechamento)</div>
                <p className="mb-3 text-xs text-muted-foreground">Base de referencia: 100% da meta no ultimo mes com dado.</p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartInsights.performanceData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={rechartsTheme.gridStroke} vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="perspective" tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
                      <YAxis
                        tick={rechartsTheme.axisTick}
                        stroke={rechartsTheme.axisStroke}
                        tickFormatter={(value) => `${value}%`}
                        domain={[0, 140]}
                      />
                      <ReferenceLine y={100} stroke="rgba(148,163,184,0.7)" strokeDasharray="4 3" />
                      <Tooltip
                        formatter={(value) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value ?? 0))}%`}
                        labelFormatter={(_, payload) => String(payload?.[0]?.payload?.perspectiveName ?? '')}
                        cursor={{ fill: 'rgba(47,119,186,0.10)' }}
                        contentStyle={rechartsTheme.tooltipContent}
                        labelStyle={rechartsTheme.tooltipLabel}
                        itemStyle={rechartsTheme.tooltipItem}
                      />
                      <Bar dataKey="attainment" radius={[8, 8, 0, 0]} maxBarSize={42}>
                        {chartInsights.performanceData.map((entry) => (
                          <Cell
                            key={`attainment-${entry.perspectiveName}`}
                            fill={
                              entry.attainment >= 100
                                ? 'rgba(37, 99, 235, 0.86)'
                                : entry.attainment >= 90
                                  ? 'rgba(59, 130, 246, 0.70)'
                                  : 'rgba(239, 68, 68, 0.72)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3">
                <div className="mb-1 text-sm font-semibold text-foreground">Distribuicao de Status</div>
                <p className="mb-3 text-xs text-muted-foreground">Contagem de indicadores por perspectiva no ultimo mes fechado.</p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartInsights.statusData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={rechartsTheme.gridStroke} vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="perspective" tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
                      <YAxis allowDecimals={false} tick={rechartsTheme.axisTick} stroke={rechartsTheme.axisStroke} />
                      <Tooltip
                        labelFormatter={(_, payload) => String(payload?.[0]?.payload?.perspectiveName ?? '')}
                        cursor={{ fill: 'rgba(47,119,186,0.08)' }}
                        contentStyle={rechartsTheme.tooltipContent}
                        labelStyle={rechartsTheme.tooltipLabel}
                        itemStyle={rechartsTheme.tooltipItem}
                      />
                      <Legend wrapperStyle={rechartsTheme.legend} />
                      <Bar dataKey="green" name="Verde" stackId="status" fill="rgba(52, 211, 153, 0.88)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="yellow" name="Amarelo" stackId="status" fill="rgba(250, 204, 21, 0.88)" />
                      <Bar dataKey="red" name="Vermelho" stackId="status" fill="rgba(251, 113, 133, 0.88)" />
                      <Bar dataKey="noData" name="Sem dados" stackId="status" fill="rgba(148, 163, 184, 0.80)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-[color:var(--surface-1)]/90 p-3">
                <div className="mb-1 text-sm font-semibold text-foreground">Top Desvios do Mes (%)</div>
                <p className="mb-3 text-xs text-muted-foreground">Variação percentual entre realizado e meta no ultimo fechamento.</p>
                {chartInsights.topVarianceData.length > 0 ? (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartInsights.topVarianceData}
                        layout="vertical"
                        margin={{ top: 8, right: 14, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid stroke={rechartsTheme.gridStroke} horizontal={false} strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tick={rechartsTheme.axisTickSmall}
                          stroke={rechartsTheme.axisStroke}
                          tickFormatter={(value) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value ?? 0))}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={64}
                          tick={rechartsTheme.axisTickSmall}
                          stroke={rechartsTheme.axisStroke}
                        />
                        <ReferenceLine x={0} stroke="rgba(148,163,184,0.7)" />
                        <Tooltip
                          formatter={(value) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value ?? 0))}%`}
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload;
                            if (!item) return '';
                            return `${item.code} - ${item.name}`;
                          }}
                          cursor={{ fill: 'rgba(47,119,186,0.08)' }}
                          contentStyle={rechartsTheme.tooltipContent}
                          labelStyle={rechartsTheme.tooltipLabel}
                          itemStyle={rechartsTheme.tooltipItem}
                        />
                        <Bar dataKey="variancePct" radius={[6, 6, 6, 6]} maxBarSize={18}>
                          {chartInsights.topVarianceData.map((entry) => (
                            <Cell
                              key={`variance-${entry.code}`}
                              fill={entry.variancePct >= 0 ? 'rgba(37, 99, 235, 0.80)' : 'rgba(251, 113, 133, 0.82)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground">
                    Sem variacoes suficientes no recorte atual.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl border-border/70 bg-[color:var(--surface-1)] shadow-sm">
            <CardHeader className="border-b border-border/70 bg-[color:var(--surface-2)]/70 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Objetivos e Indicadores</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                    {grouped.length} perspectivas
                  </Badge>
                  <Badge className="border border-border/70 bg-[color:var(--surface-1)] text-muted-foreground">
                    {totalObjectives} objetivos
                  </Badge>
                  <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    {filteredRows.length} indicadores
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full min-w-[1520px] border-collapse text-xs">
                  <tbody>
                    {grouped.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-12 text-center text-sm text-muted-foreground">
                          Nenhum indicador encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      grouped.map((perspectiveGroup) => {
                        const config = PERSPECTIVE_CONFIG[perspectiveGroup.perspectiveName] ?? {
                          label: perspectiveGroup.perspectiveName,
                          sectionBg: 'bg-[#eef3fb] dark:bg-[#15253a]',
                          sectionBorder: 'border-[#c3d4e8] dark:border-[#2f4865]',
                          sectionText: 'text-[#315f8c] dark:text-[#98c7f1]',
                          countBadge: 'border-[#b0c6df] bg-[#e3edf8] text-[#315f8c] dark:border-[#456487] dark:bg-[#1e3551] dark:text-[#a5cff4]',
                          codeBadge: 'border-[#b6cbe3] bg-[#edf4fb] text-[#315f8c] dark:border-[#426184] dark:bg-[#1c324d] dark:text-[#a0cbf2]',
                          objectiveBg: 'bg-[#f7fafd] dark:bg-[#112235]',
                        };
                        return (
                          <PerspectiveGroup
                            key={perspectiveGroup.perspectiveName}
                            persp={perspectiveGroup}
                            config={config}
                            selectedYear={year}
                            managementByIndicatorId={managementByIndicatorId}
                            managementByCode={managementByCode}
                          />
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function PerspectiveGroup({
  persp,
  config,
  selectedYear,
  managementByIndicatorId,
  managementByCode,
}: {
  persp: GroupedPerspective;
  config: {
    label: string;
    sectionBg: string;
    sectionBorder: string;
    sectionText: string;
    countBadge: string;
    codeBadge: string;
    objectiveBg: string;
  };
  selectedYear: number;
  managementByIndicatorId: Map<string, any>;
  managementByCode: Map<string, any>;
}) {
  const colCount = 9;
  return (
    <>
      <tr className={cn('border-y-2', config.sectionBg, config.sectionBorder)}>
        <td colSpan={colCount} className="px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-sm font-semibold tracking-wide', config.sectionText)}>{config.label}</span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', config.countBadge)}>
              {persp.objectives.length} {persp.objectives.length === 1 ? 'objetivo' : 'objetivos'}
            </span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', config.countBadge)}>
              {persp.totalIndicators} {persp.totalIndicators === 1 ? 'indicador' : 'indicadores'}
            </span>
          </div>
        </td>
      </tr>

      {persp.objectives.map((objectiveGroup) => (
        <ObjectiveGroup
          key={objectiveGroup.objectiveName}
          obj={objectiveGroup}
          config={config}
          selectedYear={selectedYear}
          managementByIndicatorId={managementByIndicatorId}
          managementByCode={managementByCode}
        />
      ))}
    </>
  );
}

function ObjectiveGroup({
  obj,
  config,
  selectedYear,
  managementByIndicatorId,
  managementByCode,
}: {
  obj: GroupedObjective;
  config: {
    label: string;
    sectionBg: string;
    sectionBorder: string;
    sectionText: string;
    countBadge: string;
    codeBadge: string;
    objectiveBg: string;
  };
  selectedYear: number;
  managementByIndicatorId: Map<string, any>;
  managementByCode: Map<string, any>;
}) {
  const colCount = 9;
  return (
    <>
      <tr className={cn('border-b border-border/60', config.objectiveBg)}>
        <td colSpan={colCount} className="px-4 py-2 pl-7">
          <span className="text-[12px] font-semibold text-foreground/90">{obj.objectiveName}</span>
          <span className="ml-2 text-[10px] text-muted-foreground">({obj.indicators.length})</span>
        </td>
      </tr>

      <tr className="border-b border-border/70 bg-[color:var(--surface-3)] text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <td className="px-3 py-2.5 text-left w-[320px]">Objetivo / Indicador</td>
        <td className="px-2 py-2.5 text-left w-[130px]">Responsavel</td>
        <td className="px-2 py-2.5 text-left w-[130px]">Alimentador</td>
        <td className="px-2 py-2.5 text-center w-[60px]">Nivel</td>
        <td className="px-2 py-2.5 text-left w-[140px]">Processo</td>
        <td className="px-2 py-2.5 text-left w-[150px]">Palavra-chave</td>
        <td className="px-2 py-2.5 text-right w-[120px]">Meta anual ({selectedYear})</td>
        <td className="px-2 py-2.5 text-right w-[140px]">Realizado acumulado</td>
        <td className="px-2 py-2.5 text-center w-[92px]">Acao</td>
      </tr>

      {obj.indicators.map((row: any, index: number) => {
        const management =
          managementByIndicatorId.get(String(row.id ?? '')) ??
          managementByCode.get(normalizeCodeKey(String(row.code ?? '')));
        const months = management?.months ?? [];
        const annualTargetEntry = (row.yearTargets ?? []).find((target: any) => Number(target.year) === selectedYear);
        const fallbackAnnualTargetFromMonths = months.reduce((sum: number, monthItem: any) => {
          const target = monthItem?.target;
          return target == null ? sum : sum + Number(target);
        }, 0);
        const annualTarget =
          annualTargetEntry?.targetValue == null
            ? fallbackAnnualTargetFromMonths > 0
              ? fallbackAnnualTargetFromMonths
              : null
            : Number(annualTargetEntry.targetValue);
        const realizedYtd = months.reduce((sum: number, monthItem: any) => sum + Number(monthItem.actual ?? 0), 0);
        return (
          <tr
            key={row.id}
            className={cn(
              'border-b border-border/40 transition-colors hover:bg-[color:var(--accent-soft)]/35',
              index % 2 === 0 ? 'bg-[color:var(--surface-1)]/96' : 'bg-[color:var(--surface-2)]/94',
            )}
          >
            <td className="px-3 py-2 pl-8">
              <Link
                href={`/bsc/indicator/${encodeURIComponent(row.code)}?year=${selectedYear}`}
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <Badge className={cn('px-1.5 py-0 text-[10px] font-medium', config.codeBadge)}>{row.code}</Badge>
                <span className="line-clamp-1 text-[13px] text-foreground/90">{row.name}</span>
              </Link>
            </td>
            <td className="px-2 py-2 text-[13px] text-muted-foreground">{row.responsible ?? '--'}</td>
            <td className="px-2 py-2 text-[13px] text-muted-foreground">{row.dataOwner ?? '--'}</td>
            <td className="px-2 py-2 text-center text-[13px] text-foreground">{row.level ?? '--'}</td>
            <td className="px-2 py-2 text-[13px] text-muted-foreground">{row.process ?? '--'}</td>
            <td className="px-2 py-2 text-[13px] text-muted-foreground line-clamp-1">{row.keywords ?? '--'}</td>
            <td className="px-2 py-2 text-right text-[14px] font-semibold tabular-nums text-[color:var(--accent)]">
              {formatMetricValue(annualTarget)}
            </td>
            <td className="px-2 py-2 text-right text-[14px] font-semibold tabular-nums text-foreground">
              {formatMetricValue(realizedYtd)}
            </td>
            <td className="px-2 py-2 text-center">
              <Link
                href={`/bsc/indicator/${encodeURIComponent(row.code)}?year=${selectedYear}`}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--accent)] transition-colors hover:bg-[color:var(--surface-2)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </td>
          </tr>
        );
      })}
    </>
  );
}
