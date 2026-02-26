'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BscTaskNode } from '@/services/backend';

function Node({ node, depth }: { node: BscTaskNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <>
      <tr className="border-b border-border/40">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button onClick={() => setOpen((prev) => !prev)} className="rounded border border-border/60 p-0.5">
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            ) : (
              <span className="inline-block w-4" />
            )}
            <span className="text-xs text-muted-foreground">{node.wbs}</span>
            <span>{node.name}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right text-sm">{node.assignee ?? '--'}</td>
        <td className="px-3 py-2 text-right text-sm">{node.bucket ?? '--'}</td>
        <td className="px-3 py-2 text-right text-sm">{node.percentComplete == null ? '--' : `${(node.percentComplete * 100).toFixed(1)}%`}</td>
      </tr>
      {hasChildren && open && node.children.map((child) => <Node key={child.id} node={child} depth={depth + 1} />)}
    </>
  );
}

export function BscProjectTree({ nodes }: { nodes: BscTaskNode[] }) {
  if (!nodes.length) {
    return <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">Sem tarefas para este snapshot.</div>;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-border/60">
      <table className="w-full min-w-[900px]">
        <thead className="bg-[color:var(--surface-2)]">
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left">Tarefa</th>
            <th className="px-3 py-2 text-right">Responsável</th>
            <th className="px-3 py-2 text-right">Bucket</th>
            <th className="px-3 py-2 text-right">% Concluída</th>
          </tr>
        </thead>
        <tbody>{nodes.map((node) => <Node key={node.id} node={node} depth={0} />)}</tbody>
      </table>
    </div>
  );
}

