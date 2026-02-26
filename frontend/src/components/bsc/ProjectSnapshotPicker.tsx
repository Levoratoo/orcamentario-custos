'use client';

import type { BscProject } from '@/services/backend';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ProjectSnapshotPicker({
  snapshots,
  snapshot,
  onSnapshotChange,
  projects,
  projectId,
  onProjectChange,
}: {
  snapshots: string[];
  snapshot: string;
  onSnapshotChange: (value: string) => void;
  projects: BscProject[];
  projectId: string;
  onProjectChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-[color:var(--surface-2)]/50 p-4">
      <Select value={snapshot} onValueChange={onSnapshotChange}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Snapshot" />
        </SelectTrigger>
        <SelectContent>
          {snapshots.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={projectId} onValueChange={onProjectChange}>
        <SelectTrigger className="h-9 min-w-[300px]">
          <SelectValue placeholder="Projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name} ({project._count?.tasks ?? 0} tarefas)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
