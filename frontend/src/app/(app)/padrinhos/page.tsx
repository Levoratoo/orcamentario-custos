'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/services/backend';
import { useApiClient } from '@/hooks/use-api-client';
import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type SponsorRow = {
  id: string;
  accountCode: string;
  costCenterId: string | null;
  sponsorDisplay: string;
};

export default function SponsorsAdminPage() {
  const { apiFetch } = useApiClient();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: sponsors = [] } = useQuery<SponsorRow[]>({
    queryKey: ['admin-sponsors', query],
    queryFn: () => backend.listAdminSponsors(apiFetch, query) as Promise<SponsorRow[]>,
  });

  const importMutation = useMutation({
    mutationFn: () => backend.importAdminSponsors(apiFetch, file!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
      toast.success('Importacao concluida');
      setImportOpen(false);
      setFile(null);
    },
    onError: () => toast.error('Falha ao importar padrinhos'),
  });

  return (
    <RoleGuard roles={['ADMIN']}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Gestao de Coordenador"
          description="Defina coordenadores por conta e centro de custo."
          actions={
            <Button onClick={() => setImportOpen(true)} className="bg-[color:var(--accent-2)] text-[#0b0b0b]">
              Importar padrinhos
            </Button>
          }
        />

        <div className="flex items-center gap-2">
          <Input placeholder="Buscar conta ou padrinho" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <DataTable>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface-3)] text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Conta</th>
                  <th className="px-4 py-3 text-left">Centro de custo</th>
                  <th className="px-4 py-3 text-left">Padrinho</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{item.accountCode}</td>
                    <td className="px-4 py-3">{item.costCenterId ?? '-'}</td>
                    <td className="px-4 py-3">{item.sponsorDisplay}</td>
                  </tr>
                ))}
                {sponsors.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum padrinho encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DataTable>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Importar padrinhos</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <Input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!file || importMutation.isPending} onClick={() => importMutation.mutate()}>
                {importMutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
