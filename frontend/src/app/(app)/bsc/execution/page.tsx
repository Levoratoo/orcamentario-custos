'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { backend } from '@/services/backend';
import { BscNav } from '@/features/bsc/bsc-nav';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectSnapshotPicker } from '@/components/bsc/ProjectSnapshotPicker';
import { ProjectTree } from '@/components/bsc/ProjectTree';
import { LoadingState } from '@/components/bsc/LoadingState';
import { ErrorState } from '@/components/bsc/ErrorState';

export default function BscExecutionPage() {
  const { apiFetch } = useApiClient();
  const [snapshot, setSnapshot] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');

  const snapshotsQuery = useQuery({
    queryKey: ['bsc-project-snapshots'],
    queryFn: () => backend.getBscProjectSnapshots(apiFetch),
  });

  const snapshots = snapshotsQuery.data ?? [];
  const effectiveSnapshot = snapshot || snapshots[0] || '';

  const projectsQuery = useQuery({
    queryKey: ['bsc-projects', effectiveSnapshot],
    enabled: Boolean(effectiveSnapshot),
    queryFn: () => backend.getBscProjects(apiFetch, effectiveSnapshot),
  });

  const projects = projectsQuery.data ?? [];
  const effectiveProjectId = projectId || projects[0]?.id || '';

  const tasksQuery = useQuery({
    queryKey: ['bsc-project-tasks', effectiveProjectId],
    enabled: Boolean(effectiveProjectId),
    queryFn: () => backend.getBscProjectTasks(apiFetch, effectiveProjectId),
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === effectiveProjectId) ?? projects[0],
    [projects, effectiveProjectId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Execucao de Projetos (MS Project)</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento por snapshot.</p>
        </div>
        <BscNav />
      </div>

      <ProjectSnapshotPicker
        snapshots={snapshots}
        snapshot={effectiveSnapshot}
        onSnapshotChange={(value) => {
          setSnapshot(value);
          setProjectId('');
        }}
        projects={projects}
        projectId={effectiveProjectId}
        onProjectChange={setProjectId}
      />

      {tasksQuery.isLoading ? <LoadingState label="Carregando tarefas..." /> : null}
      {tasksQuery.isError ? <ErrorState label="Falha ao carregar tarefas do projeto." /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm text-muted-foreground">
            {selectedProject
              ? `${selectedProject.name} • ${String(selectedProject.snapshotDate).slice(0, 10)}`
              : 'Sem projeto selecionado'}
          </div>
          {!tasksQuery.isLoading && !tasksQuery.isError ? <ProjectTree nodes={tasksQuery.data?.taskTree ?? []} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
