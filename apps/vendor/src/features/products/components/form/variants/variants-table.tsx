"use client"

import { useMemo, useState } from "react"
import { Controller, useFieldArray, useWatch } from "react-hook-form"
import { useMutation, useQuery } from "@apollo/client/react"
import {
  ChevronDownIcon,
  FilterIcon,
  HandshakeIcon,
  ImagePlusIcon,
  SearchIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  GET_INVENTORY_LEVELS,
  GET_INVENTORY_LOCATIONS,
} from "@/features/inventory/api"
import { UPSERT_NEGOTIATION_POLICY } from "@/features/negotiation/api"
import { NegotiationFloorMode } from "@/shared/api/generated/graphql"
import { MoneyOrPercentSuffix, MoneySuffix } from "@/shared/components/money-suffix"
import { cn } from "@/shared/lib/utils"
import type { ProductFormApi } from "@/features/products/validations/product"
import type { OptionAxis } from "./use-variant-options"

interface VariantsTableProps {
  form: ProductFormApi
  axes: OptionAxis[]
  /** Edit-mode only — a saved product to read per-location stock against. */
  productId?: string
}

type GroupedRow = {
  key: string
  parentValue: string
  axisName: string
  childIndices: number[]
}

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
}

type LocationsResp = {
  inventoryLocations: { success: boolean; data: Location[] }
}
type LevelsResp = {
  inventoryLevels: { success: boolean; data: Level[] }
}

/** Sentinel for the "All locations" entry — `Select` is string-only. */
const ALL_LOCATIONS = "__all__"

/** The tracking override, encoded for the string-only `Select`. */
type TrackKey = "inherit" | "tracked" | "untracked"

/**
 * What the Available column is showing, which is the one thing the whole
 * table pivots on:
 *
 *  - `form`     — create mode. One number per variant, staged on the form,
 *                 seeded by the back-end at the shop's default location.
 *  - `all`      — edit mode, "All locations". The rollup across locations,
 *                 read-only: there is no single warehouse to write it to.
 *  - `location` — edit mode, one location picked. Editable, staged onto
 *                 `inventory_levels` and flushed after the product saves.
 */
type AvailableView =
  | { kind: "form" }
  | { kind: "all" }
  | { kind: "location"; id: string; name: string }

/**
 * Variants table mirroring Shopify's layout.
 *
 *  - **Single-axis**: flat list of variants; one row per value.
 *  - **Multi-axis**: optional `Group by <axis>` header. Parents are the
 *    selected axis' values (collapsible chevron + "N variants" summary);
 *    children are the individual combinations. Parent price/availability
 *    stays disabled — only leaf rows are editable.
 *
 * Stock is per-location and the location lives in this toolbar, not in a
 * card of its own: one row per variant already exists here, and a second
 * table repeating them under an expander asked the vendor to hold two
 * lists of the same variants in their head. Edits stage behind the
 * contextual save bar like every other field on the form.
 *
 * The toolbar's Search (option values and SKU) and Filter (per-axis value
 * ticks) narrow the rows client-side. They hide rows, never form entries:
 * the footer total still counts every variant, and a hidden row's staged
 * values ride along to Save untouched.
 */
export function VariantsTable({ form, axes, productId }: VariantsTableProps) {
  const t = useTranslations("products.variantsTable")
  const tc = useTranslations("common")
  const { control, register } = form
  const { fields } = useFieldArray({ control, name: "variation_options" })
  const watchedRaw = useWatch({ control, name: "variation_options" })
  const stagedRaw = useWatch({ control, name: "inventory_levels" })
  // Memoised rather than defaulted inline: both feed `useMemo` dependency
  // lists below, and a fresh `[]` on every render would rebuild them all.
  const watched = useMemo(() => watchedRaw ?? [], [watchedRaw])
  const stagedLevels = useMemo(() => stagedRaw ?? [], [stagedRaw])

  const committedAxes = useMemo(
    () => axes.filter((a) => !a.isEditing && a.name && a.values.length > 0),
    [axes],
  )

  const [groupBy, setGroupBy] = useState<string | null>(
    () => committedAxes[0]?.name ?? null,
  )
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [locationChoice, setLocationChoice] = useState<string>(ALL_LOCATIONS)

  // Search and filter narrow what is *drawn*, never what the form holds: a
  // hidden row keeps its staged values and its index-based `register` name,
  // because `useForm` sets no `shouldUnregister`. Both are local to the table.
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  /** Axis name → the values ticked in the Filter popover, as the vendor left them. */
  const [valueFilter, setValueFilter] = useState<Record<string, string[]>>({})

  // Selection state for bulk actions
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [bulkPriceValue, setBulkPriceValue] = useState("")
  const [bulkPolicyOpen, setBulkPolicyOpen] = useState(false)
  const [bulkPolicyEnabled, setBulkPolicyEnabled] = useState(true)
  const [bulkFloorMode, setBulkFloorMode] = useState<"max_discount" | "min_price">("max_discount")
  const [bulkFloorValue, setBulkFloorValue] = useState("15")
  const [bulkPolicyLoading, setBulkPolicyLoading] = useState(false)

  const [upsertPolicy] = useMutation(UPSERT_NEGOTIATION_POLICY)

  // Locations and levels are both a single request for the whole table.
  // `include_variations` is what makes the second one possible — a variant's
  // level carries `product_id = NULL`, so without it this would be one query
  // per variant to fill one column.
  const { data: locsData } = useQuery<LocationsResp>(GET_INVENTORY_LOCATIONS, {
    skip: !productId,
    fetchPolicy: "cache-first",
  })
  const { data: levelsData } = useQuery<LevelsResp>(GET_INVENTORY_LEVELS, {
    variables: { product_id: productId, include_variations: true },
    skip: !productId,
    fetchPolicy: "cache-and-network",
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

  /** variationOptionId → locationId → available, straight off the server. */
  const serverLevels = useMemo(() => {
    const byVariant = new Map<string, Map<string, number>>()
    for (const lvl of levelsData?.inventoryLevels?.data ?? []) {
      if (!lvl.variation_option_id) continue
      let byLoc = byVariant.get(lvl.variation_option_id)
      if (!byLoc) {
        byLoc = new Map<string, number>()
        byVariant.set(lvl.variation_option_id, byLoc)
      }
      byLoc.set(lvl.location_id, lvl.available)
    }
    return byVariant
  }, [levelsData])

  const stagedByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of stagedLevels) {
      m.set(`${l.variation_option_id}:${l.location_id}`, Number(l.available))
    }
    return m
  }, [stagedLevels])

  // A single-location shop is shown its one location rather than an "All"
  // aggregate over it — the aggregate is read-only, and that would leave a
  // vendor with one warehouse no way to edit stock at all.
  const view: AvailableView = useMemo(() => {
    if (!productId) return { kind: "form" }
    if (locations.length === 1) {
      return { kind: "location", id: locations[0].id, name: locations[0].name }
    }
    const picked = locations.find((l) => l.id === locationChoice)
    return picked
      ? { kind: "location", id: picked.id, name: picked.name }
      : { kind: "all" }
  }, [productId, locations, locationChoice])

  const showLocationPicker = !!productId && locations.length > 1

  // Keep `groupBy` pointing at a committed axis when axes change.
  const resolvedGroupBy =
    groupBy && committedAxes.some((a) => a.name === groupBy)
      ? groupBy
      : (committedAxes[0]?.name ?? null)

  const showGrouping = committedAxes.length >= 2 && resolvedGroupBy !== null

  /**
   * The number the Available column shows for one row, under the current
   * view. A variant with no server id was added in this session and has no
   * levels anywhere, so it always falls back to its form quantity — that
   * figure becomes its opening stock at the default location on save.
   */
  const availableAt = (index: number): number => {
    const variantId = watched[index]?.id
    const formQty = Number(watched[index]?.quantity) || 0
    if (!variantId || view.kind === "form") return formQty

    const byLoc = serverLevels.get(variantId)
    if (view.kind === "location") {
      const staged = stagedByKey.get(`${variantId}:${view.id}`)
      if (staged !== undefined) return staged
      // No level row anywhere yet — a product that predates the ledger, or
      // one whose stock was only ever written to `quantity`. Showing 0 at the
      // default location would read as "you lost your stock", so the rollup
      // stands in until the first real level exists.
      if (!byLoc || byLoc.size === 0) {
        return locations.find((l) => l.id === view.id)?.is_default ? formQty : 0
      }
      return byLoc.get(view.id) ?? 0
    }

    // All locations: the rollup, moved by anything staged in this session.
    if (!byLoc || byLoc.size === 0) return formQty
    let sum = 0
    for (const loc of locations) {
      sum += stagedByKey.get(`${variantId}:${loc.id}`) ?? byLoc.get(loc.id) ?? 0
    }
    return sum
  }

  /** Stage one per-location figure onto the form so the save bar owns it. */
  const stageLevel = (variantId: string, locationId: string, raw: string) => {
    const parsed = raw === "" ? 0 : Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) return
    const current = form.getValues("inventory_levels") ?? []
    const idx = current.findIndex(
      (l) =>
        l.variation_option_id === variantId && l.location_id === locationId,
    )
    const next =
      idx >= 0
        ? current.map((l, i) =>
            i === idx ? { ...l, available: parsed } : l,
          )
        : [
            ...current,
            {
              variation_option_id: variantId,
              location_id: locationId,
              available: parsed,
            },
          ]
    form.setValue("inventory_levels", next, {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  const totalInventory = watched.reduce(
    (sum: number, _v, i: number) => sum + availableAt(i),
    0,
  )

  const groupedRows: GroupedRow[] = useMemo(() => {
    if (!showGrouping) return []
    const axis = committedAxes.find((a) => a.name === resolvedGroupBy)!
    const byValue = new Map<string, number[]>()
    for (let i = 0; i < watched.length; i += 1) {
      const v = watched[i]
      const value = (v?.options as Record<string, string> | undefined)?.[
        axis.name
      ]
      if (value == null) continue
      if (!byValue.has(value)) byValue.set(value, [])
      byValue.get(value)!.push(i)
    }
    return axis.values
      .filter((v) => byValue.has(v))
      .map((value) => ({
        key: value,
        parentValue: value,
        axisName: axis.name,
        childIndices: byValue.get(value) ?? [],
      }))
  }, [committedAxes, resolvedGroupBy, showGrouping, watched])

  // The filter as it applies right now, derived during render the way
  // `resolvedGroupBy` is rather than reconciled in an effect: an axis or a
  // value the vendor has since deleted simply drops out, so a stale tick can
  // never hide every row behind a control that no longer lists it.
  const activeFilter = useMemo(() => {
    const next: Record<string, string[]> = {}
    for (const axis of committedAxes) {
      const kept = (valueFilter[axis.name] ?? []).filter((v) =>
        axis.values.includes(v),
      )
      if (kept.length > 0) next[axis.name] = kept
    }
    return next
  }, [committedAxes, valueFilter])

  const q = search.trim().toLowerCase()
  const anySelection = Object.keys(activeFilter).length > 0
  const filtering = q !== "" || anySelection

  // Membership by the field-array index, never a re-numbered list: rows are
  // skipped at render time, so `renderChildRow(i)` keeps binding each input
  // to its own `variation_options.${i}` name.
  const visible = useMemo(() => {
    const set = new Set<number>()
    for (let i = 0; i < watched.length; i += 1) {
      const options =
        (watched[i]?.options as Record<string, string> | undefined) ?? {}
      if (q !== "") {
        const haystack = [...Object.values(options), watched[i]?.sku ?? ""]
        if (!haystack.some((s) => String(s).toLowerCase().includes(q))) {
          continue
        }
      }
      const passes = Object.entries(activeFilter).every(([axisName, picked]) =>
        picked.includes(options[axisName]),
      )
      if (passes) set.add(i)
    }
    return set
  }, [watched, q, activeFilter])

  // Grouped rows with the hidden children taken out and empty parents
  // dropped. The parent row is then a statement about the rows beneath it —
  // its count, its total and the price it pushes down all cover the visible
  // children only — so a filter never writes to a variant it is hiding.
  const visibleGroups: GroupedRow[] = groupedRows
    .map((g) => ({
      ...g,
      childIndices: g.childIndices.filter((i) => visible.has(i)),
    }))
    .filter((g) => g.childIndices.length > 0)

  const toggleValue = (axisName: string, value: string) => {
    setValueFilter((prev) => {
      const current = prev[axisName] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [axisName]: next }
    })
  }

  const closeSearch = () => {
    setSearch("")
    setSearchOpen(false)
  }

  const clearAll = () => {
    closeSearch()
    setValueFilter({})
  }

  const allCollapsed =
    showGrouping && groupedRows.every((g) => collapsed[g.key])

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed({})
    } else {
      const next: Record<string, boolean> = {}
      for (const g of groupedRows) next[g.key] = true
      setCollapsed(next)
    }
  }

  const toggleSelectOne = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const allVisibleSelected =
    visible.size > 0 && Array.from(visible).every((i) => selectedIndices.has(i))
  const someVisibleSelected =
    Array.from(visible).some((i) => selectedIndices.has(i)) && !allVisibleSelected

  const toggleSelectAllVisible = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const i of visible) next.delete(i)
      } else {
        for (const i of visible) next.add(i)
      }
      return next
    })
  }

  const isGroupAllSelected = (childIndices: number[]) =>
    childIndices.length > 0 && childIndices.every((i) => selectedIndices.has(i))
  const isGroupSomeSelected = (childIndices: number[]) =>
    childIndices.some((i) => selectedIndices.has(i)) && !isGroupAllSelected(childIndices)

  const toggleSelectGroup = (childIndices: number[]) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (isGroupAllSelected(childIndices)) {
        for (const i of childIndices) next.delete(i)
      } else {
        for (const i of childIndices) next.add(i)
      }
      return next
    })
  }

  const applyBulkPrice = () => {
    const numeric = bulkPriceValue === "" ? 0 : Number(bulkPriceValue)
    if (!Number.isFinite(numeric)) return
    for (const i of selectedIndices) {
      form.setValue(`variation_options.${i}.price` as const, numeric, {
        shouldDirty: true,
        shouldValidate: false,
      })
    }
    sileo.success({
      title: t("priceUpdated", { price: numeric, count: selectedIndices.size }),
    })
    setBulkPriceOpen(false)
    setBulkPriceValue("")
  }

  const applyBulkPolicy = async () => {
    setBulkPolicyLoading(true)
    try {
      const selectedVariantIds = Array.from(selectedIndices)
        .map((i) => watched[i]?.id)
        .filter((id): id is string => Boolean(id))

      if (productId && selectedVariantIds.length > 0) {
        const bps =
          bulkFloorMode === "max_discount" && bulkFloorValue !== ""
            ? Math.round(Number(bulkFloorValue) * 100)
            : null
        const minCents =
          bulkFloorMode === "min_price" && bulkFloorValue !== ""
            ? Math.round(Number(bulkFloorValue) * 100)
            : null

        await Promise.all(
          selectedVariantIds.map((varId) =>
            upsertPolicy({
              variables: {
                input: {
                  product_id: productId,
                  variation_option_id: varId,
                  enabled: bulkPolicyEnabled,
                  floor_mode: bulkPolicyEnabled
                    ? bulkFloorMode === "max_discount"
                      ? NegotiationFloorMode.MaxDiscount
                      : NegotiationFloorMode.MinPrice
                    : undefined,
                  max_discount_bps: bps,
                  minimum_price_cents: minCents,
                },
              },
            }),
          ),
        )
      }
      sileo.success({
        title: t("policyApplied", { count: selectedIndices.size }),
      })
      setBulkPolicyOpen(false)
    } catch (err) {
      sileo.error({
        title: t("policyFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    } finally {
      setBulkPolicyLoading(false)
    }
  }

  if (fields.length === 0) return null

  const renderChildRow = (index: number, indent = false) => {
    const current = watched[index]
    const optionValues = Object.values(
      (current?.options as Record<string, string> | undefined) ?? {},
    )
    // When grouped, strip the parent axis value from the label so the child
    // row shows only the other axes' values.
    const label =
      showGrouping && resolvedGroupBy
        ? Object.entries(
            (current?.options as Record<string, string> | undefined) ?? {},
          )
            .filter(([k]) => k !== resolvedGroupBy)
            .map(([, v]) => v)
            .join(" / ")
        : optionValues.join(" / ")

    // Per-variant tracking override (Shopify-parity #2.10). Tri-state:
    //   null  → inherit parent product's track_quantity (common case)
    //   true  → variant is tracked (override "on" when parent is off)
    //   false → variant is untracked (license-key / digital — always
    //           in-stock regardless of `quantity`)
    // We render it as a small select. The `Select` component is string-
    // only, so the form value is encoded:
    //   "inherit" ↔ null, "tracked" ↔ true, "untracked" ↔ false.
    const trackOverride =
      watched[index]?.track_quantity === undefined
        ? null
        : watched[index]?.track_quantity ?? null
    const trackKey: TrackKey =
      trackOverride === null
        ? "inherit"
        : trackOverride
          ? "tracked"
          : "untracked"
    const setTrackOverride = (next: string | null) => {
      if (next == null) return
      const value =
        next === "inherit" ? null : next === "tracked" ? true : false
      form.setValue(`variation_options.${index}.track_quantity` as const, value, {
        shouldDirty: true,
        shouldValidate: false,
      })
    }

    const variantId = watched[index]?.id
    const sku = watched[index]?.sku

    return (
      <div
        key={index}
        className={cn(
          "flex items-center gap-3 border-t px-4 py-2",
          indent && "ps-10",
        )}
      >
        <Checkbox
          aria-label={label ? t("selectNamed", { name: label }) : t("selectVariant")}
          className="size-4"
          checked={selectedIndices.has(index)}
          onCheckedChange={() => toggleSelectOne(index)}
        />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ImagePlaceholder />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm">{label}</span>
            {sku ? (
              <span className="truncate text-xs text-muted-foreground">
                {sku}
              </span>
            ) : null}
          </div>
        </div>
        <div className="relative w-40">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            className="h-9 pe-12"
            {...register(`variation_options.${index}.price` as const)}
          />
          <MoneySuffix className="text-[11px]" />
        </div>
        <div className="w-24">
          {view.kind === "all" && variantId ? (
            <span className="block px-1 text-sm tabular-nums text-foreground">
              {availableAt(index)}
            </span>
          ) : view.kind === "location" && variantId ? (
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="0"
              className="h-9"
              disabled={trackOverride === false}
              value={availableAt(index)}
              onChange={(e) =>
                stageLevel(variantId, view.id, e.target.value)
              }
            />
          ) : (
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="0"
              className="h-9"
              disabled={trackOverride === false}
              title={variantId ? undefined : t("openingStockHint")}
              {...register(`variation_options.${index}.quantity` as const)}
            />
          )}
        </div>
        <div className="w-28">
          <Select value={trackKey} onValueChange={setTrackOverride}>
            <SelectTrigger size="sm" className="h-9 w-full">
              {/* The value is an encoding key, so the trigger is told its
                  label — left to itself it renders the raw "inherit". */}
              <SelectValue>
                {(value: string | null) =>
                  t(`tracking.${(value as TrackKey | null) ?? "inherit"}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{t("tracking.inherit")}</SelectItem>
              <SelectItem value="tracked">{t("tracking.tracked")}</SelectItem>
              <SelectItem value="untracked">{t("tracking.untracked")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Controller
          control={control}
          name={`variation_options.${index}.is_disable`}
          render={() => <></>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: group-by + search/filter icons + location scope */}
      <div className="flex items-center justify-between">
        {showGrouping ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t("groupBy")}</span>
            <Select
              value={resolvedGroupBy ?? ""}
              onValueChange={(v) => setGroupBy(v)}
            >
              <SelectTrigger size="sm" className="h-7 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {committedAxes.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span />
        )}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          {searchOpen && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                // Mounts on the click, so this never steals focus on page load.
                autoFocus
                aria-label={t("search")}
                placeholder={t("search")}
                className="h-7 w-48 ps-7 text-xs md:text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    closeSearch()
                  }
                  // The table sits inside the product <form>; Enter here
                  // would submit it.
                  if (e.key === "Enter") e.preventDefault()
                }}
                // An empty box that lost focus is clutter; one with a query
                // in it stays, because the rows are still narrowed by it.
                onBlur={() => {
                  if (search === "") setSearchOpen(false)
                }}
              />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 aria-pressed:bg-muted aria-pressed:text-foreground"
            aria-label={t("search")}
            aria-pressed={searchOpen || q !== ""}
            // Keep focus in the input on a press: otherwise its blur closes
            // the empty box first and this click reopens it, so the vendor
            // clicks "close" and nothing happens.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <SearchIcon className="size-3.5" />
          </Button>
          {committedAxes.length > 0 && (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger
                render={(p) => (
                  <Button
                    {...p}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 aria-pressed:bg-muted aria-pressed:text-foreground"
                    aria-label={t("filter")}
                    aria-pressed={anySelection}
                  >
                    <FilterIcon className="size-3.5" />
                  </Button>
                )}
              />
              <PopoverContent align="end" className="w-56 gap-0 p-1.5">
                {committedAxes.map((axis) => (
                  <div key={axis.id}>
                    <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
                      {axis.name}
                    </p>
                    {axis.values.map((value) => {
                      const selected =
                        activeFilter[axis.name]?.includes(value) ?? false
                      return (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                            selected ? "bg-accent font-medium" : "hover:bg-accent/60",
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleValue(axis.name, value)}
                          />
                          <span className="min-w-0 flex-1 truncate">{value}</span>
                        </label>
                      )
                    })}
                  </div>
                ))}
                {anySelection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 justify-start"
                    onClick={() => setValueFilter({})}
                  >
                    {t("clearFilters")}
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
          {showLocationPicker && (
            <Select
              value={locationChoice}
              onValueChange={(v) => setLocationChoice(v ?? ALL_LOCATIONS)}
            >
              <SelectTrigger
                size="sm"
                className="ml-1 h-7 w-auto max-w-[14rem]"
                aria-label={t("stockLocation")}
              >
                {/* The value is a location id, so the trigger has to be told
                    the name — left to itself it renders the raw cuid. */}
                <SelectValue>
                  {(value: string | null) =>
                    locations.find((l) => l.id === value)?.name ??
                    t("allLocations")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_LOCATIONS}>{t("allLocations")}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {selectedIndices.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 p-2.5 text-xs border border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {t("selectedCount", { count: selectedIndices.size })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedIndices(new Set())}
            >
              {t("deselectAll")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Edit Price Popover */}
            <Popover open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
              <PopoverTrigger
                render={(p) => (
                  <Button {...p} type="button" variant="outline" size="sm" className="h-7 text-xs">
                    {t("editPrice")}
                  </Button>
                )}
              />
              <PopoverContent align="end" className="w-64 p-3 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium">
                    {t("setPriceFor", { count: selectedIndices.size })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("appliesToSelected")}</p>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={bulkPriceValue}
                    onChange={(e) => setBulkPriceValue(e.target.value)}
                    className="h-8 pe-12 text-xs"
                  />
                  <MoneySuffix className="text-[11px] font-normal" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBulkPriceOpen(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={applyBulkPrice}
                  >
                    {t("apply")}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Bulk Negotiation Policy Popover */}
            <Popover open={bulkPolicyOpen} onOpenChange={setBulkPolicyOpen}>
              <PopoverTrigger
                render={(p) => (
                  <Button {...p} type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <HandshakeIcon className="size-3.5 text-primary" />
                    {t("negotiationPolicy")}
                  </Button>
                )}
              />
              <PopoverContent align="end" className="w-80 p-3 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold">{t("bulkPolicyTitle")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("bulkPolicyBody", { count: selectedIndices.size })}
                  </p>
                </div>

                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{t("status")}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={bulkPolicyEnabled ? "default" : "outline"}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setBulkPolicyEnabled(true)}
                      >
                        {t("enable")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!bulkPolicyEnabled ? "default" : "outline"}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setBulkPolicyEnabled(false)}
                      >
                        {t("disable")}
                      </Button>
                    </div>
                  </div>

                  {bulkPolicyEnabled && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">{t("floorMode")}</label>
                        <Select
                          value={bulkFloorMode}
                          onValueChange={(v) => setBulkFloorMode(v as "max_discount" | "min_price")}
                        >
                          <SelectTrigger size="sm" className="h-7 text-xs">
                            {/* Told its label, like the tracking select: the
                                value is a mode key, not something to read. */}
                            <SelectValue>
                              {(value: string | null) =>
                                value === "min_price"
                                  ? t("floorMinPrice")
                                  : t("floorMaxDiscount")
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="max_discount">{t("floorMaxDiscount")}</SelectItem>
                            <SelectItem value="min_price">{t("floorMinPrice")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          {bulkFloorMode === "max_discount" ? t("maxDiscountLabel") : t("minFloorLabel")}
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={bulkFloorMode === "max_discount" ? 100 : undefined}
                            step={bulkFloorMode === "max_discount" ? 1 : 0.01}
                            placeholder={bulkFloorMode === "max_discount" ? "15" : "50.00"}
                            value={bulkFloorValue}
                            onChange={(e) => setBulkFloorValue(e.target.value)}
                            className="h-8 pe-12 text-xs"
                          />
                          <MoneyOrPercentSuffix
                            percent={bulkFloorMode === "max_discount"}
                            className="text-[11px] font-normal"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBulkPolicyOpen(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={bulkPolicyLoading}
                    onClick={applyBulkPolicy}
                  >
                    {bulkPolicyLoading ? t("saving") : t("applyToSelected")}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border">
        {/* Column headers */}
        <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
          <Checkbox
            aria-label={t("selectAll")}
            className="size-4"
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            onCheckedChange={toggleSelectAllVisible}
          />
          <div className="flex flex-1 items-center gap-2">
            <span>{t("column.variant")}</span>
            {/* While narrowed, the count takes the collapse toggle's slot:
                collapse is ignored so matches are never hidden under a
                folded parent, which would leave the toggle doing nothing. */}
            {filtering ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span aria-live="polite">
                  {t("showing", { visible: visible.size, total: watched.length })}
                </span>
              </>
            ) : (
              showGrouping && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="font-medium hover:text-foreground"
                  >
                    {allCollapsed ? t("expandAll") : t("collapseAll")}
                  </button>
                </>
              )
            )}
          </div>
          <span className="w-40 text-start">{t("column.price")}</span>
          <span
            className="w-24 text-start"
            title={
              view.kind === "all" ? t("column.availableAllHint") : undefined
            }
          >
            {t("column.available")}
          </span>
          <span className="w-28 text-start" title={t("column.trackingHint")}>
            {t("column.tracking")}
          </span>
        </div>

        {visible.size === 0 ? (
          <div className="flex items-center justify-center gap-2 border-t px-4 py-6 text-center text-sm text-muted-foreground">
            <span>{t("noMatch")}</span>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              {tc("clear")}
            </Button>
          </div>
        ) : showGrouping ? (
          visibleGroups.map((group) => {
            const isCollapsed = !filtering && !!collapsed[group.key]
            const groupTotal = group.childIndices.reduce(
              (s, i) => s + availableAt(i),
              0,
            )
            // If every child shares the same price, surface it on the
            // parent; otherwise leave blank so the merchant can see the
            // rows diverge. Editing the parent pushes the value down — to
            // the children on screen, since `childIndices` is already the
            // filtered list. Reaching the hidden ones too would be a write
            // to a row the merchant cannot see happen.
            const prices = group.childIndices.map((i) =>
              Number(watched[i]?.price) || 0,
            )
            const allSame =
              prices.length > 0 && prices.every((p) => p === prices[0])
            const parentPrice = allSame ? prices[0] : ""

            const applyPriceToChildren = (next: string) => {
              const numeric = next === "" ? 0 : Number(next)
              if (!Number.isFinite(numeric)) return
              for (const i of group.childIndices) {
                form.setValue(
                  `variation_options.${i}.price` as const,
                  numeric,
                  { shouldDirty: true, shouldValidate: false },
                )
              }
            }

            return (
              <div key={group.key}>
                <div className="flex items-center gap-3 border-t bg-background px-4 py-2">
                  <Checkbox
                    aria-label={t("selectNamed", { name: group.parentValue })}
                    className="size-4"
                    checked={isGroupAllSelected(group.childIndices)}
                    indeterminate={isGroupSomeSelected(group.childIndices)}
                    onCheckedChange={() => toggleSelectGroup(group.childIndices)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({
                        ...c,
                        [group.key]: !c[group.key],
                      }))
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-start"
                  >
                    <ImagePlaceholder />
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">
                        {group.parentValue}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("variantCount", { count: group.childIndices.length })}
                        <ChevronDownIcon
                          className={cn(
                            "ml-1 inline size-3 transition",
                            isCollapsed && "-rotate-90",
                          )}
                        />
                      </span>
                    </div>
                  </button>
                  <div className="relative w-40">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder={allSame ? "0.00" : t("mixed")}
                      value={parentPrice}
                      onChange={(e) => applyPriceToChildren(e.target.value)}
                      className="h-9 pe-12"
                    />
                    <MoneySuffix className="text-[11px]" />
                  </div>
                  {/* The group total is a sum of its children in whatever
                      scope is selected — never editable, at any scope. */}
                  <span className="block w-24 px-1 text-sm tabular-nums text-foreground">
                    {groupTotal}
                  </span>
                  {/* Tracking column spacer — overrides apply per-leaf
                      variant, not at the group level. Leave the parent
                      row blank to keep the table columns aligned. */}
                  <div className="w-28" />
                </div>
                {!isCollapsed &&
                  group.childIndices.map((i) => renderChildRow(i, true))}
              </div>
            )
          })
        ) : (
          fields.map((_f, i) => (visible.has(i) ? renderChildRow(i) : null))
        )}

        <div className="border-t bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
          <InventoryFooter view={view} total={totalInventory} />
        </div>
      </div>
    </div>
  )
}

/**
 * The line under the table. It names the scope the number was counted in,
 * because "513 available" means something different per location than it
 * does across all of them — and a location holding none of this product
 * says so rather than showing a bare 0.
 */
function InventoryFooter({
  view,
  total,
}: {
  view: AvailableView
  total: number
}) {
  const t = useTranslations("products.variantsTable.footer")
  if (view.kind === "location" && total === 0) {
    return <>{t("notStocked", { location: view.name })}</>
  }
  // One whole sentence per scope rather than a translated scope phrase
  // spliced into a shared frame: word order around it differs by language.
  const b = (chunks: React.ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  )
  return (
    <>
      {view.kind === "all"
        ? t.rich("totalAll", { total, b })
        : view.kind === "location"
          ? t.rich("totalAt", { total, location: view.name, b })
          : t.rich("totalDefault", { total, b })}
    </>
  )
}

function ImagePlaceholder() {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50 bg-primary/5 text-primary">
      <ImagePlusIcon className="size-4" />
    </div>
  )
}
