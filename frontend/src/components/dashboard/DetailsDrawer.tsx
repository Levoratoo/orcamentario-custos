import { useCallback, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDeltaValue, formatPercent } from '@/lib/format';
import { DreRow } from '@/services/dre/types';
import { cn } from '@/lib/utils';

interface DrawerSummary {
  value: number;
  pctOfRevenue?: number | null;
  deltaValue?: number | null;
  deltaPct?: number | null;
  compareYear?: number | null;
}

interface DetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  summary?: DrawerSummary;
  rows: DreRow[];
  monthFilter?: string | null;
  mode?: 'previsto' | 'realizado' | 'projetado';
  rawPayload?: unknown;
  onViewDre?: () => void;
}

type TreeNode = {
  id: string;
  name: string;
  level: number;
  value: number;
  children: TreeNode[];
};

function buildTree(rows: DreRow[], monthFilter?: string | null, mode: 'previsto' | 'realizado' | 'projetado' = 'previsto') {
  const nodes = new Map<string, TreeNode>();
  const childrenByParent = new Map<string | null, TreeNode[]>();

  const getValue = (row: DreRow) => {
    if (monthFilter) {
      const value = row.valoresPorMes[monthFilter];
      return mode === 'projetado' ? value?.projetado ?? value?.previsto ?? 0 : value?.[mode] ?? 0;
    }
    return Object.values(row.valoresPorMes).reduce((sum, value) => {
      const next = mode === 'projetado' ? value.projetado ?? value.previsto : value[mode];
      return sum + (next ?? 0);
    }, 0);
  };

  rows.forEach((row) => {
    const node: TreeNode = {
      id: row.id,
      name: row.descricao,
      level: row.nivel,
      value: getValue(row),
      children: [],
    };
    nodes.set(row.id, node);
    const parentId = row.parentId ?? null;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(node);
    childrenByParent.set(parentId, list);
  });

  nodes.forEach((node, id) => {
    const children = childrenByParent.get(id);
    if (children) node.children = children;
  });

  return childrenByParent.get(null) ?? [];
}

export function DetailsDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  summary,
  rows,
  monthFilter,
  mode = 'previsto',
  rawPayload,
  onViewDre,
}: DetailsDrawerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(rows, monthFilter, mode), [rows, monthFilter, mode]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const detailRows = useMemo(() => {
    const getValue = (row: DreRow) => {
      if (monthFilter) {
        const value = row.valoresPorMes[monthFilter];
        return mode === 'projetado' ? value?.projetado ?? value?.previsto ?? 0 : value?.[mode] ?? 0;
      }
      return Object.values(row.valoresPorMes).reduce((sum, value) => {
        const next = mode === 'projetado' ? value.projetado ?? value.previsto : value[mode];
        return sum + (next ?? 0);
      }, 0);
    };

    return rows.map((row) => ({
      id: row.id,
      name: row.descricao,
      value: getValue(row),
    }));
  }, [rows, monthFilter, mode]);

  const exportCsv = () => {
    const lines = ['Conta,Valor'];
    detailRows.forEach((row) => {
      lines.push(`"${row.name.replace(/\"/g, '""')}",${row.value}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detalhes-${title.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>

        {summary && (
          <div className="px-4 text-sm text-muted-foreground">
            <div className={cn('text-xl font-semibold', summary.value < 0 && 'text-rose-300')}>
              {formatCurrency(summary.value)}
            </div>
            {summary.pctOfRevenue !== undefined && (
              <div>{summary.pctOfRevenue === null ? '-' : `${formatPercent(summary.pctOfRevenue)} da receita`}</div>
            )}
            {summary.deltaValue != null && summary.deltaPct != null && summary.compareYear ? (
              <div className={summary.deltaValue < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {formatDeltaValue(summary.deltaValue, summary.deltaPct, summary.compareYear)}
              </div>
            ) : (
              <div>Sem base comparativa</div>
            )}
          </div>
        )}

        <Tabs defaultValue="detail" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4">
            <TabsTrigger value="detail">Detalhe</TabsTrigger>
            <TabsTrigger value="drill">Drill-down</TabsTrigger>
            {Boolean(rawPayload) && <TabsTrigger value="data">Dados</TabsTrigger>}
          </TabsList>
          <TabsContent value="detail" className="min-h-0 flex-1 overflow-auto px-4">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Conta</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="py-2 text-muted-foreground">{row.name}</td>
                    <td className={cn('py-2 text-right tabular-nums', row.value < 0 && 'text-rose-300')}>
                      {formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
          <TabsContent value="drill" className="min-h-0 flex-1 overflow-auto px-4">
            <div className="space-y-2">
              {tree.map((node) => (
                <TreeRow key={node.id} node={node} expanded={expanded} onToggle={toggle} />
              ))}
            </div>
          </TabsContent>
          {Boolean(rawPayload) && (
            <TabsContent value="data" className="min-h-0 flex-1 overflow-auto px-4">
              <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            </TabsContent>
          )}
        </Tabs>

        <SheetFooter className="gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={onViewDre}>
              Ver no DRE
            </Button>
          </div>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TreeRow({
  node,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${node.level * 12}px` }}>
          {hasChildren ? (
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-[11px]"
              onClick={() => onToggle(node.id)}
            >
              {isExpanded ? '-' : '+'}
            </button>
          ) : (
            <span className="h-5 w-5" />
          )}
          <span className={cn('text-sm', node.level <= 1 && 'font-semibold')}>{node.name}</span>
        </div>
        <span className={cn('text-sm tabular-nums', node.value < 0 && 'text-rose-300')}>
          {formatCurrency(node.value)}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
