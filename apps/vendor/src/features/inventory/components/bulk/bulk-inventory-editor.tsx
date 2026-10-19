"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  useApolloClient,
  useMutation,
  useSuspenseQuery,
  useQuery,
} from "@apollo/client/react"
import { Loader2, ArrowLeft, Search } from "lucide-react"
import { sileo } from "sileo"
import { GET_INVENTORY_LEVELS, GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { SET_INVENTORY_AVAILABLE } from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"

type Location = {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
}

type Product = {
  id: string
  name: Record<string, string> | string
  slug: string
  quantity: number
  product_type: string
  image: { thumbnail?: string } | null
  // Nullable from the list query — guard every read.
  variation_options: Array<{
    id: string
    title: Record<string, string> | string
    quantity: number
  }> | null
}

type LocationsResp = {
  inventoryLocations: { success: boolean; data: Location[] }
}
type ProductsResp = {
  products: { success: boolean; data: Product[]; meta: { total: number } }
}
type LevelsResp = {
  inventoryLevels: {
    success: boolean
    data: Array<{
      id: string
      location_id: string
      product_id: string | null
      variation_option_id: string | null
      available: number
    }>
  }
}

/**
 * Shopify-parity bulk inventory editor. One row per (product OR variation),
 * one column per location. Each cell is an editable number that commits on
 * blur via `setInventoryAvailable`. The dirty/saving state is per-cell so
 * a slow network on row 12 doesn't freeze row 13.
 *
 * Levels are fetched lazily per visible product (not in bulk) — keeps the
 * first paint fast and avoids a 50-product * 5-location N×M payload up
 * front. The trade-off: opening a product row briefly shows a spinner.
 */
export function BulkInventoryEditor() {
  const t = useTranslations("inventory")
  const locale = useLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const { data: locsData } = useSuspenseQuery<LocationsResp>(
    GET_INVENTORY_LOCATIONS,
  )
  const { data: productsData } = useSuspenseQuery<ProductsResp>(GET_PRODUCTS, {
    variables: { filters: { page: 1, limit: 50 } },
  })

  const locations = useMemo(
    () =>
      (locsData?.inventoryLocations?.data ?? [])
        .filter((l) => l.is_active)
        .sort((a, b) =>
          a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1,
        ),
    [locsData],
  )
  const products = productsData?.products?.data ?? []

  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const name = displayName(p.name, locale)
      return name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    })
  }, [products, search, locale])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {shopSlug && (
              <Link
                href={`/store/${shopSlug}/products/inventory`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                {t("title")}
              </Link>
            )}
          </div>
          <h1 className="font-heading text-2xl font-semibold">
            {t("bulk.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("bulk.subtitle")}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("bulk.filterPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t.rich("bulk.noLocations", {
            link: (chunks) =>
              shopSlug ? (
                <Link
                  href={`/store/${shopSlug}/products/inventory/locations`}
                  className="font-medium text-foreground underline"
                >
                  {chunks}
                </Link>
              ) : (
                chunks
              ),
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky start-0 z-10 bg-muted px-4 py-2.5 text-start">
                    {t("bulk.product")}
                  </th>
                  {locations.map((loc) => (
                    <th
                      key={loc.id}
                      className="whitespace-nowrap px-3 py-2.5 text-end"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>{loc.name}</span>
                        {loc.is_default && (
                          <span className="rounded-full bg-card px-1.5 py-0.5 text-[9px] font-semibold text-foreground/70 ring-1 ring-foreground/10">
                            {t("locations.default")}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={locations.length + 1}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {t("bulk.noMatch")}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <ProductRows
                    key={p.id}
                    product={p}
                    locations={locations}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One product = one main row (SIMPLE) or N+1 rows (VARIABLE: header + variant
 * rows). All cells share a single LevelsResp query per product.
 */
function ProductRows({
  product,
  locations,
}: {
  product: Product
  locations: Location[]
}) {
  const t = useTranslations("inventory.bulk")
  const locale = useLocale()
  const isVariable = product.product_type === "VARIABLE"

  // For VARIABLE: query per-variation rolled up. For SIMPLE: query by product.
  // The single query returns all rows for the (product or variations) — the
  // table cells filter by location_id.
  const { data, loading } = useQuery<LevelsResp>(GET_INVENTORY_LEVELS, {
    variables: { product_id: product.id },
    fetchPolicy: "cache-and-network",
  })

  const levels = data?.inventoryLevels?.data ?? []

  return (
    <>
      <tr className="border-t border-border bg-card transition-colors hover:bg-muted/30">
        <td className="sticky start-0 z-10 bg-card px-4 py-2.5">
          <div className="flex items-center gap-3">
            {product.image && typeof product.image === "object" && product.image.thumbnail && (
              <img
                src={product.image.thumbnail}
                alt=""
                className="size-9 shrink-0 rounded object-cover ring-1 ring-foreground/10"
              />
            )}
            <div className="min-w-0">
              <div className="truncate font-medium">
                {displayName(product.name, locale)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{product.slug}</span>
                {isVariable && (
                  <Badge variant="outline" className="h-4 text-[9px]">
                    {t("variants", {
                      count: product.variation_options?.length ?? 0,
                    })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </td>

        {isVariable
          ? // VARIABLE: leave cells blank in the parent row — totals live below.
            locations.map((loc) => (
              <td
                key={loc.id}
                className="px-3 py-2.5 text-end text-xs text-muted-foreground"
              >
                —
              </td>
            ))
          : locations.map((loc) => (
              <LevelCell
                key={loc.id}
                productId={product.id}
                variationOptionId={null}
                locationId={loc.id}
                serverValue={
                  levels.find(
                    (lv) =>
                      lv.location_id === loc.id &&
                      lv.variation_option_id === null,
                  )?.available ?? 0
                }
                loading={loading}
              />
            ))}
      </tr>

      {isVariable &&
        (product.variation_options ?? []).map((v) => (
          <tr
            key={v.id}
            className="border-t border-border/60 bg-card/60 transition-colors hover:bg-muted/30"
          >
            <td className="sticky start-0 z-10 bg-card/60 px-4 py-2 ps-12 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {displayName(v.title, locale)}
              </span>
            </td>
            {locations.map((loc) => (
              <LevelCell
                key={loc.id}
                productId={null}
                variationOptionId={v.id}
                locationId={loc.id}
                serverValue={
                  levels.find(
                    (lv) =>
                      lv.location_id === loc.id &&
                      lv.variation_option_id === v.id,
                  )?.available ?? 0
                }
                loading={loading}
              />
            ))}
          </tr>
        ))}
    </>
  )
}

/**
 * One editable cell. Maintains its own dirty state so neighboring cells'
 * saves don't disrupt user typing. On blur (or Enter) fires a focused
 * setInventoryAvailable mutation and refetches the parent levels query
 * + InventoryHistory so the audit row is visible immediately.
 */
function LevelCell({
  productId,
  variationOptionId,
  locationId,
  serverValue,
  loading,
}: {
  productId: string | null
  variationOptionId: string | null
  locationId: string
  serverValue: number
  loading: boolean
}) {
  const t = useTranslations("inventory.bulk")
  const apollo = useApolloClient()
  const [value, setValue] = useState(String(serverValue))
  // State, not a ref: this drives the amber "unsaved" ring and the skeleton
  // gate below, so it is read during render — and a ref read during render is
  // a value React is not tracking.
  const [dirty, setDirty] = useState(false)
  const [syncedValue, setSyncedValue] = useState(serverValue)

  // Resync when the server pushes a new value, but only if the user has not
  // typed. Keyed on the server value and adjusted during render: an effect
  // keyed the same way would ALSO re-fire the moment `dirty` cleared after a
  // save, reverting the input to a server value the refetch has not returned
  // yet — the number the vendor just entered visibly flipping back.
  if (serverValue !== syncedValue) {
    setSyncedValue(serverValue)
    if (!dirty) setValue(String(serverValue))
  }

  const [setAvailable, { loading: saving }] = useMutation(
    SET_INVENTORY_AVAILABLE,
  )

  async function commit() {
    if (!dirty) return
    const next = Number(value)
    if (!Number.isFinite(next) || next < 0) {
      sileo.error({ title: t("quantityInvalid") })
      setValue(String(serverValue))
      setDirty(false)
      return
    }
    if (next === serverValue) {
      setDirty(false)
      return
    }
    try {
      await setAvailable({
        variables: {
          input: {
            location_id: locationId,
            product_id: productId,
            variation_option_id: variationOptionId,
            available: next,
          },
        },
      })
      setDirty(false)
      void apollo.refetchQueries({
        include: [GET_INVENTORY_LEVELS, "InventoryHistory"],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed")
      sileo.error({ title: msg })
      setValue(String(serverValue))
      setDirty(false)
    }
  }

  if (loading && !dirty && value === "0") {
    return (
      <td className="px-3 py-2 text-end">
        <Skeleton className="ms-auto h-9 w-20" />
      </td>
    )
  }

  return (
    <td className="px-3 py-2 text-end">
      <div className="relative inline-block w-24">
        <Input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => {
            setDirty(true)
            setValue(e.target.value)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          disabled={saving}
          className={cn(
            "h-9 pr-7 text-right tabular-nums",
            dirty && "ring-2 ring-amber-500/40",
          )}
        />
        {saving && (
          <Loader2
            aria-hidden
            className="absolute end-1.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>
    </td>
  )
}

/** A product/variant name in the dashboard's language, falling back to any. */
function displayName(
  name: Record<string, string> | string,
  locale: string,
): string {
  if (typeof name === "string") return name
  return (
    name?.[locale] ?? name?.en ?? name?.ar ?? Object.values(name ?? {})[0] ?? "—"
  )
}
