'use client';

import { Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function UploadImportCard({
  importsCount,
  uploading,
  canImport,
  onPickFile,
}: {
  importsCount: number;
  uploading: boolean;
  canImport: boolean;
  onPickFile: (file: File | null) => void;
}) {
  return (
    <Card className="border-border/70 bg-[color:var(--surface-1)] shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-muted-foreground">Historico de importacoes: {importsCount}</div>
        {canImport ? (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-xs font-semibold text-emerald-100">
            <Upload className="h-4 w-4" />
            {uploading ? 'Importando...' : 'Importar Excel BSC'}
            <input
              type="file"
              className="hidden"
              accept=".xlsx"
              disabled={uploading}
              onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
