"use client"

import { Search, MapPin, Barcode, RefreshCw, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface FiltersBarProps {
  totalCount: number
  searchValue: string
  locationValue: string
  batchValue: string
  onlyPositive: boolean
  onSearchChange: (value: string) => void
  onLocationChange: (value: string) => void
  onBatchChange: (value: string) => void
  onOnlyPositiveChange: (value: boolean) => void
  onClear: () => void
  onRefresh: () => void
  isRefreshing?: boolean
  className?: string
}

export function FiltersBar({
  totalCount,
  searchValue,
  locationValue,
  batchValue,
  onlyPositive,
  onSearchChange,
  onLocationChange,
  onBatchChange,
  onOnlyPositiveChange,
  onClear,
  onRefresh,
  isRefreshing,
  className,
}: FiltersBarProps) {
  return (
    <Card
      className={cn(
        "sticky top-4 z-20 w-full rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
          {totalCount} itens
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(240px,1fr)_minmax(200px,1fr)_minmax(180px,1fr)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Codigo ou descricao"
            className="pl-9"
          />
        </div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={locationValue}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder="Localizacao"
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Barcode className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={batchValue}
            onChange={(event) => onBatchChange(event.target.value)}
            placeholder="Lote"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <Switch checked={onlyPositive} onCheckedChange={onOnlyPositiveChange} />
          Somente saldo &gt; 0
        </label>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border/60" onClick={onClear}>
            Limpar filtros
          </Button>
          <Button
            className="bg-[color:var(--accent-2)] text-[#0b0b0b] shadow-lg shadow-sm hover:bg-[color:var(--accent)]"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isRefreshing ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </div>
    </Card>
  )
}

