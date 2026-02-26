import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, helper, icon, className }: StatCardProps) {
  return (
    <Card className={cn('card-glow flex h-full items-center justify-between gap-4 rounded-xl bg-card p-5', className)}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>
      {icon && <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--surface-2)] text-[color:var(--accent)]">{icon}</div>}
    </Card>
  );
}
