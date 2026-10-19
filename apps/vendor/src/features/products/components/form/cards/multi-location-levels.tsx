"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  useApolloClient,
  useMutation,
  useSuspenseQuery,
} from "@apollo/client/react"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { GET_INVENTORY_LEVELS, GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { SET_INVENTORY_AVAILABLE } from "@/features/inventory/api"
import { Field } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { sileo } from "sileo"

type Location = {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
}

type Level = {
  id: string
  location_id: string
  product_id: string | null
  variation_option_id: string | null
  available: number
  committed: number
}

type LocationsResp = {
  inventoryLocations: { success: boolean; data: Location[] }
}
type LevelsResp = {
  inventoryLevels: { success: boolean; data: Level[] }
}

interface Props {
  productId: string
}

/**
 * Editable per-location stock table — replaces the single "Shop location: 0"
 * row when a product has more than one place that holds it.
 *
 * Each row binds to local state seeded from the InventoryLevel.available.
 * On blur, fires `setInventoryAvailable` against that (location, product)
 * level — Apollo mutates the server + the helper service writes a
 * MANUAL_ADJUSTMENT audit row + recomputes Product.quantity rollup. Local
 * state is then realigned from the refetched query so concurrent edits
 * from another tab don't strand a stale number.
 *
 * Locations the vendor created but where the product has zero stock show
 * available=0; typing a number and tabbing out creates the level row
 * server-side (`InventoryService.findOrCreateLevel`).
 */
export function MultiLocationLevels({ productId }: Props) {
  const t = useTranslations("products.multiLocation")
  const apollo = useApolloClient()

  const { data: locsData } = useSuspenseQuery<LocationsResp>(
    GET_INVENTORY_LOCATIONS
  )
  const { data: levelsData } = useSuspenseQuery<LevelsResp>(
    GET_INVENTORY_LEVELS,
    { variables: { product_id: productId } }
  )

  const locations = useMemo(
    () =>
      (locsData?.inventoryLocations?.data ?? [])
        .filter((l) => l.is_active)
        .sort((a, b) =>
          a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1
        ),
    [locsData]
  )
  const levels = levelsData?.inventoryLevels?.data ?? []

  // Map locationId → available, seeded from server, mutated locally on edit.
  const seedFromServer = useMemo(() => {
    const m = new Map<string, number>()
    for (const loc of locations) {
      const lvl = levels.find(
        (l) => l.location_id === loc.id && l.variation_option_id === null
      )
      m.set(loc.id, lvl?.available ?? 0)
    }
    return m
  }, [locations, levels])

  const [local, setLocal] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    seedFromServer.forEach((v, k) => m.set(k, String(v)))
    return m
  })

  // Resync when server-side values change (e.g. another tab edited). Guards
  // against clobbering an in-flight edit by only updating rows that don't
  // already have a pending dirty value.
  const dirtyRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    setLocal((prev) => {
      const next = new Map(prev)
      seedFromServer.forEach((v, k) => {
        if (!dirtyRef.current.has(k)) next.set(k, String(v))
      })
      return next
    })
  }, [seedFromServer])

  const [savingId, setSavingId] = useState<string | null>(null)
  const [setAvailable] = useMutation(SET_INVENTORY_AVAILABLE)

  async function commit(locationId: string) {
    const raw = local.get(locationId) ?? ""
    const next = Number(raw)
    if (!Number.isFinite(next) || next < 0) {
      sileo.error({ title: t("invalidQuantity") })
      return
    }
    const current = seedFromServer.get(locationId) ?? 0
    if (next === current) {
      dirtyRef.current.delete(locationId)
      return
    }

    setSavingId(locationId)
    try {
      await setAvailable({
        variables: {
          input: {
            location_id: locationId,
            product_id: productId,
            available: next,
          },
        },
      })
      sileo.success({ title: t("stockUpdated") })
      dirtyRef.current.delete(locationId)
      // Refetch so the read-side seed picks up the new server truth and any
      // sibling levels (parent rollup) that changed downstream.
      void apollo.refetchQueries({
        include: [GET_INVENTORY_LEVELS, GET_INVENTORY_LOCATIONS],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed")
      sileo.error({ title: msg })
      // Roll back local to server value so the dirty input doesn't keep the
      // user's stale typed digit looking saved.
      setLocal((prev) => {
        const next = new Map(prev)
        next.set(locationId, String(seedFromServer.get(locationId) ?? 0))
        return next
      })
      dirtyRef.current.delete(locationId)
    } finally {
      setSavingId(null)
    }
  }

  const total = Array.from(seedFromServer.values()).reduce((a, b) => a + b, 0)

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <div className="grid grid-cols-[1fr_auto] items-center bg-muted px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
        <span>{t("quantity")}</span>
        <span className="pr-3">{t("available")}</span>
      </div>
      {locations.map((loc) => {
        const value = local.get(loc.id) ?? "0"
        const isSaving = savingId === loc.id
        return (
          <div
            key={loc.id}
            className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-foreground/10 bg-card px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm text-foreground">
              {loc.name}
              {loc.is_default && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {t("default")}
                </span>
              )}
            </span>
            <Field className="w-28">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  className="h-9 pr-7 text-right tabular-nums"
                  value={value}
                  onChange={(e) => {
                    dirtyRef.current.add(loc.id)
                    const v = e.target.value
                    setLocal((prev) => {
                      const next = new Map(prev)
                      next.set(loc.id, v)
                      return next
                    })
                  }}
                  onBlur={() => commit(loc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                  disabled={isSaving}
                />
                {isSaving && (
                  <Loader2
                    aria-hidden
                    className="absolute end-1.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  />
                )}
              </div>
            </Field>
          </div>
        )
      })}

      {locations.length > 1 && (
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-foreground/10 bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">{t("total")}</span>
          <span className="pr-3 font-semibold tabular-nums text-foreground">
            {total}
          </span>
        </div>
      )}
    </div>
  )
}
