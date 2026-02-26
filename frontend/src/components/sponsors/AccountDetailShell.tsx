'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface AccountDetailShellProps {
  title: string;
  subtitle?: string;
  status?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function AccountDetailShell({ title, subtitle, status, onBack, actions, children }: AccountDetailShellProps) {
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl border border-border/60 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{title}</div>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
            {actions}
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Voltar
              </Button>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
