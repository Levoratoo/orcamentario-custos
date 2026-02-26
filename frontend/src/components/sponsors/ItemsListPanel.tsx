'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BudgetItem } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { CommentPopover } from './CommentPopover';
import { NewItemDialog } from './NewItemDialog';

interface ItemsListPanelProps {
  items: BudgetItem[];
  canEdit?: boolean;
  onCreate: (name: string) => void;
  onUpdate: (id: string, data: Partial<BudgetItem>) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleReimbursement: (id: string, value: boolean) => void;
  onComment: (id: string, value: string) => void;
}

export function ItemsListPanel({
  items,
  canEdit = true,
  onCreate,
  onUpdate,
  onToggleActive,
  onToggleReimbursement,
  onComment,
}: ItemsListPanelProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = items.filter((item) => item.itemName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar item" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button onClick={() => setDialogOpen(true)} disabled={!canEdit}>+ Novo item</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={item.itemName}
                onChange={(event) => onUpdate(item.id, { itemName: event.target.value })}
                className="h-8 text-sm"
                disabled={!canEdit}
              />
              <div className="text-sm font-semibold">{formatMoney(item.total)}</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Switch checked={item.isActive} onCheckedChange={(value) => onToggleActive(item.id, value)} disabled={!canEdit} />
                <span>{item.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={item.isReimbursement} onCheckedChange={(value) => onToggleReimbursement(item.id, value)} disabled={!canEdit} />
                <span>Ressarcimento</span>
                {item.isReimbursement && <Badge variant="secondary">Ressarcimento</Badge>}
              </div>
              <CommentPopover value={item.comment ?? ''} onSave={(value) => onComment(item.id, value)} disabled={!canEdit} />
              {item.total === 0 && <Badge variant="secondary">Zeros</Badge>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
            Nenhum item encontrado.
          </div>
        )}
      </div>
      <NewItemDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={onCreate} />
    </div>
  );
}
