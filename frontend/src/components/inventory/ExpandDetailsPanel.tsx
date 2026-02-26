"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/CopyButton"
import { cn } from "@/lib/utils"

export interface InventoryDetails {
  group?: string | null
  location?: string | null
  batch?: string | null
  balance?: string | number | null
  unit?: string | null
  balanceUnitCost?: string | number | null
  unitCost?: string | number | null
  costPrice?: string | number | null
  stockPrice?: string | number | null
  cubage?: string | number | null
  weight?: string | number | null
  volume?: string | number | null
  orderNumber?: string | null
  customerCode?: string | null
  customerName?: string | null
  validity?: string | null
}

interface ExpandDetailsPanelProps {
  details: InventoryDetails
  className?: string
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number") return value.toString()
  if (value === "29/12/1899") return "—"
  return value
}

function validityBadge(validity?: string | null) {
  if (!validity || validity === "29/12/1899") {
    return (
      <Badge variant="secondary" className="border border-border/60 bg-[color:var(--surface-2)] text-muted-foreground">
        Sem validade
      </Badge>
    )
  }
  return null
}

export function ExpandDetailsPanel({ details, className }: ExpandDetailsPanelProps) {
  const summary = [
    details.group ?? "—",
    details.location ?? "—",
    details.batch ?? "—",
    details.balance ?? "—",
  ].join(" | ")

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("overflow-hidden", className)}
    >
      <div className="mt-4 rounded-2xl border border-border/60 bg-[color:var(--surface-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Detalhes do item</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge className="border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                Grupo: {formatValue(details.group)}
              </Badge>
              <Badge className="border border-border/60 bg-[color:var(--surface-3)] text-muted-foreground">
                Local: {formatValue(details.location)}
              </Badge>
              <Badge className="border border-border/60 bg-[color:var(--surface-3)] text-muted-foreground">
                Lote: {formatValue(details.batch)}
              </Badge>
              {validityBadge(details.validity)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton value={summary} label="Copiar resumo" />
            <Button variant="outline" size="sm" className="border-border/60">
              Ver historico
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-glow rounded-2xl bg-[color:var(--surface-1)] p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Estoque</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Saldo</span>
                <span className="font-medium">{formatValue(details.balance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unid</span>
                <span className="font-medium">{formatValue(details.unit)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Saldo Un Custo</span>
                <span className="font-medium">{formatValue(details.balanceUnitCost)}</span>
              </div>
            </div>
          </Card>
          <Card className="card-glow rounded-2xl bg-[color:var(--surface-1)] p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Custo</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Un Custo</span>
                <span className="font-medium">{formatValue(details.unitCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Prec Custo</span>
                <span className="font-medium">{formatValue(details.costPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Prec Est</span>
                <span className="font-medium">{formatValue(details.stockPrice)}</span>
              </div>
            </div>
          </Card>
          <Card className="card-glow rounded-2xl bg-[color:var(--surface-1)] p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Logistica</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Cubagem</span>
                <span className="font-medium">{formatValue(details.cubage)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Peso</span>
                <span className="font-medium">{formatValue(details.weight)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Volume</span>
                <span className="font-medium">{formatValue(details.volume)}</span>
              </div>
            </div>
          </Card>
          <Card className="card-glow rounded-2xl bg-[color:var(--surface-1)] p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Cliente/Ordem</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>NumOrdem</span>
                <span className="font-medium">{formatValue(details.orderNumber)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>CodCliente</span>
                <span className="font-medium">{formatValue(details.customerCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>NomeCliente</span>
                <span className="font-medium">{formatValue(details.customerName)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
