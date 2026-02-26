"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/CopyButton"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { ExpandDetailsPanel, InventoryDetails } from "@/components/inventory/ExpandDetailsPanel"
import { cn } from "@/lib/utils"

export interface InventoryRow {
  id: string
  code: string
  description: string
  location: string
  balance: number | string
  details: InventoryDetails
}

interface InventoryTableProps {
  items: InventoryRow[]
  isLoading?: boolean
  emptyMessage?: string
  expandedId?: string | null
  onToggleExpand?: (id: string | null) => void
}

export function InventoryTable({
  items,
  isLoading,
  emptyMessage = "Nenhum item encontrado.",
  expandedId,
  onToggleExpand,
}: InventoryTableProps) {
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null)
  const activeExpanded = expandedId ?? internalExpanded

  const rows = useMemo(() => items ?? [], [items])

  const handleToggle = (id: string) => {
    const next = activeExpanded === id ? null : id
    if (onToggleExpand) {
      onToggleExpand(next)
    } else {
      setInternalExpanded(next)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={`row-${index}`} className="h-12 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="Nada por aqui"
        description={emptyMessage}
        action={<Button variant="outline">Ajustar filtros</Button>}
      />
    )
  }

  return (
    <div className="card-glow overflow-hidden rounded-2xl bg-[color:var(--surface-1)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[color:var(--surface-2)]">
            <TableHead className="w-[44px]" />
            <TableHead className="w-[160px]">Codigo</TableHead>
            <TableHead>Descricao</TableHead>
            <TableHead className="w-[140px]">Localizacao</TableHead>
            <TableHead className="w-[120px] text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item, index) => {
            const expanded = activeExpanded === item.id
            return (
              <TableRow
                key={item.id}
                className={cn(
                  "group border-b border-border/60 transition hover:bg-[color:var(--surface-2)]",
                  index % 2 === 1 && "bg-[color:var(--surface-1)]/60",
                  expanded && "accent-divider bg-[color:var(--surface-2)]"
                )}
              >
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggle(item.id)}
                    className="h-9 w-9 rounded-full border border-border/60"
                    aria-label="Expandir"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                  </Button>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span>{item.code}</span>
                    <CopyButton
                      value={item.code}
                      className="opacity-0 transition group-hover:opacity-100"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{item.description}</div>
                    <div className="text-xs text-muted-foreground">ID: {item.id}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    {item.location}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {item.balance}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {activeExpanded && (
        <div className="px-6 pb-6">
          <ExpandDetailsPanel details={rows.find((row) => row.id === activeExpanded)?.details ?? {}} />
        </div>
      )}
    </div>
  )
}
