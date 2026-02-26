"use client";

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { BudgetScenarioImportResult } from '@/lib/types';

interface BudgetScenarioImportDialogProps {
  onImported: (result: BudgetScenarioImportResult) => void;
  scenarioId?: string | null;
}

export function BudgetScenarioImportDialog({ onImported, scenarioId }: BudgetScenarioImportDialogProps) {
  const { apiFetch } = useApiClient();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const mutation = useMutation({
    mutationFn: () => backend.importBudgetScenario(apiFetch, files, scenarioId ?? undefined),
    onSuccess: (result) => {
      onImported(result);
      toast.success(`Importacao concluida: ${result.totalRows} linhas`);
      setOpen(false);
      setFiles([]);
    },
    onError: () => {
      toast.error('Falha ao importar');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <UploadCloud className="mr-2 h-4 w-4" />
          Importar planilhas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar planilhas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files ?? []);
              setFiles(nextFiles);
            }}
          />
          {files.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {files.map((file) => (
                <div key={file.name}>{file.name}</div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={files.length === 0 || mutation.isPending || !scenarioId}>
            {mutation.isPending ? 'Importando...' : 'Importar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
