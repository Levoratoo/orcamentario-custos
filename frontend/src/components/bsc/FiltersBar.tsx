'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function FiltersBar({
  year,
  onYearChange,
  search,
  onSearchChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-[color:var(--surface-2)]/50 p-4">
      <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
        <SelectTrigger className="h-9 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[2025, 2026, 2027, 2028].map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-9 max-w-sm"
        placeholder="Buscar por codigo, nome ou objetivo"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  );
}
