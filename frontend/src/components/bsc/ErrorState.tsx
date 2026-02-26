'use client';

export function ErrorState({ label = 'Erro ao carregar dados.' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
      {label}
    </div>
  );
}
