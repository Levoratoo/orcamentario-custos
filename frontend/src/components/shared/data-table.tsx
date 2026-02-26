import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataTableProps {
  children: ReactNode;
  className?: string;
}

export function DataTable({ children, className }: DataTableProps) {
  return (
    <Card className={cn('card-glow overflow-hidden rounded-xl bg-card', className)}>
      {children}
    </Card>
  );
}
