'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BudgetItem } from '@/lib/types';
import { formatMoney } from '@/lib/money';

interface ProjectionGridProps {
  year: number;
  items: BudgetItem[];
  canEdit?: boolean;
  onValueChange: (itemId: string, month: number, value: number) => void;
  onApplyAll: (itemId: string, value: number) => void;
  onCopyFromMonth: (itemId: string, fromMonth: number) => void;
  onDistribute: (itemId: string, total: number) => void;
  onZero: (itemId: string) => void;
}

export function ProjectionGrid({
  year,
  items,
  canEdit = true,
  onValueChange,
  onApplyAll,
  onCopyFromMonth,
  onDistribute,
  onZero,
}: ProjectionGridProps) {
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  return (
    <div className="overflow-auto rounded-2xl border border-border/60">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="sticky top-0 bg-[color:var(--surface-3)] text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            {months.map((month) => (
              <th key={month} className="px-3 py-2 text-right">{String(month).padStart(2, '0')}/{year}</th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border/60">
              <td className="px-3 py-2 font-medium">{item.itemName}</td>
              {months.map((month) => (
                <td key={`${item.id}-${month}`} className="px-2 py-2 text-right">
                  <Input
                    disabled={!item.isActive || !canEdit}
                    className="h-8 text-right"
                    value={formatMoney(item.monthValues[month] ?? 0)}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
                      const num = Number(raw || 0);
                      onValueChange(item.id, month, Number.isFinite(num) ? num : 0);
                    }}
                  />
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold">{formatMoney(item.total)}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onApplyAll(item.id, item.monthValues[1] ?? 0)} disabled={!canEdit}>
                    Aplicar todos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onCopyFromMonth(item.id, 1)} disabled={!canEdit}>
                    Copiar mes 01
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDistribute(item.id, item.total)} disabled={!canEdit}>
                    Distribuir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onZero(item.id)} disabled={!canEdit}>
                    Zerar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={15} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum item cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
