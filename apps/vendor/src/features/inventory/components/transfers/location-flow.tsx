"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { MapPin, Truck, ChevronDown, Search, Plus } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"

export type LocOption = { id: string; name: string }
export type SupplierOption = { id: string; name: string }

/**
 * The Shopify transfer header rail: origin → (truck) In transit → destination,
 * with an actions slot on the trailing edge. `origin` / `destination` are
 * arbitrary nodes so the same layout serves the read-only detail page (plain
 * pills) and the editable form (location pickers).
 */
export function FlowBar({
  origin,
  destination,
  actions,
}: {
  origin: ReactNode
  destination: ReactNode
  actions?: ReactNode
}) {
  const t = useTranslations("transfers.flow")
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {origin}
        <Arrow />
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium text-muted-foreground">
          <Truck className="size-4" />
          {t("inTransit")}
        </span>
        <Arrow />
        {destination}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

function Arrow() {
  return (
    <span className="text-muted-foreground rtl:rotate-180" aria-hidden>
      →
    </span>
  )
}

/** Read-only endpoint pill (detail page). */
export function LocationPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium">
      <MapPin className="size-4 text-muted-foreground" />
      {label}
    </span>
  )
}

/**
 * Editable endpoint picker (form). Value is a location id, or `null` for an
 * external/unspecified endpoint. Suppliers are listed for Shopify parity and
 * map to an unspecified endpoint (inbound-from / outbound-to an external party)
 * — the chosen supplier name is shown for the session via `label`.
 */
export function LocationPicker({
  value,
  label,
  onChange,
  locations,
  suppliers,
  placeholder,
  excludeId,
  suppliersHref,
}: {
  value: string | null
  label?: string | null
  onChange: (value: string | null, label?: string | null) => void
  locations: LocOption[]
  suppliers: SupplierOption[]
  placeholder: string
  excludeId?: string | null
  suppliersHref?: string
}) {
  const t = useTranslations("transfers.flow")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const display = useMemo(() => {
    if (value) return locations.find((l) => l.id === value)?.name ?? value
    if (label) return label
    return null
  }, [value, label, locations])

  const q = query.trim().toLowerCase()
  const filteredLocs = locations.filter(
    (l) =>
      l.id !== excludeId && (!q || l.name.toLowerCase().includes(q)),
  )
  const filteredSuppliers = suppliers.filter(
    (s) => !q || s.name.toLowerCase().includes(q),
  )

  const pick = (v: string | null, lbl?: string | null) => {
    onChange(v, lbl)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(p) => (
          <button
            {...p}
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium ring-1 ring-transparent transition-colors hover:bg-muted aria-expanded:ring-ring/40",
              !display && "text-muted-foreground",
            )}
          >
            <MapPin className="size-4 text-muted-foreground" />
            {display ?? placeholder}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        )}
      />
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchLocations")}
              className="h-8 ps-8"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => pick(null, null)}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted",
              value === null && !label && "bg-muted",
            )}
          >
            {t("unspecified")}
          </button>

          <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            {t("locations")}
          </div>
          {filteredLocs.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => pick(l.id)}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted",
                value === l.id && "bg-muted",
              )}
            >
              {l.name}
            </button>
          ))}

          <div className="flex items-center justify-between px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            <span>{t("suppliers")}</span>
            {suppliersHref && (
              <Link
                href={suppliersHref}
                className="text-foreground/70 hover:text-foreground"
                aria-label={t("suppliers")}
              >
                <Plus className="size-3.5" />
              </Link>
            )}
          </div>
          {filteredSuppliers.length === 0 ? (
            <p className="px-2 py-2 text-center text-xs text-muted-foreground">
              {t("noSuppliers")}
            </p>
          ) : (
            filteredSuppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(null, s.name)}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted",
                  label === s.name && "bg-muted",
                )}
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
