'use client';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-[color:var(--surface-2)]/40 p-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
