"use client"

import { useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"

import { text } from "@/shared/lib/multilang"
import { CATALOG_FACETS } from "../api"
import { activeFilterCount, type CatalogFilters } from "../lib/filters"

/**
 * The filter panel.
 *
 * It is a **controlled, apply-on-change** panel rather than a staged form with
 * an Apply button, for everything except the price inputs. A checkbox that does
 * nothing until you find a button is the pattern people abandon; a price field
 * that refetches on every keystroke is the one that hammers the API. So the
 * boxes commit immediately and the prices commit on blur/Enter.
 *
 * Facets come from the shop's own `tags` and `collections`, so it can never
 * offer a filter that matches nothing in this store.
 */
export function CatalogFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: CatalogFilters
  onChange: (next: Partial<CatalogFilters>) => void
  onClear: () => void
}) {
  const t = useTranslations("catalog")
  const locale = useLocale()

  // Preloaded by the catalogue page, so the filter list is in the server's
  // HTML with the products it filters — a panel that populated a beat later
  // would let a shopper tick a box that was not there when they reached for it.
  const { data } = useSuspenseQuery(CATALOG_FACETS, {
    fetchPolicy: "cache-first",
    // A panel that cannot list its tags is a panel with no filters in it, not a
    // broken catalogue — and this read is preloaded, so throwing would take the
    // products beside it down too.
    errorPolicy: "all",
  })
  const tags = data?.tags.data ?? []
  const collections = data?.collections.data ?? []

  const active = activeFilterCount(filters)

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between pb-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {t("filters")}
        </h2>
        {active > 0 && (
          <Button
            variant="ghost"
            size="xs"
            className="text-shop-accent hover:text-shop-accent"
            onClick={onClear}
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>

      <FilterGroup label={t("availability")}>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={filters.inStockOnly}
            onCheckedChange={(checked) =>
              onChange({ inStockOnly: checked === true })
            }
          />
          {t("inStockOnly")}
        </label>
      </FilterGroup>

      <FilterGroup label={t("price")}>
        <div className="flex items-center gap-2">
          <PriceInput
            label={t("priceMin")}
            value={filters.minPrice}
            onCommit={(value) => onChange({ minPrice: value })}
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <PriceInput
            label={t("priceMax")}
            value={filters.maxPrice}
            onCommit={(value) => onChange({ maxPrice: value })}
          />
        </div>
      </FilterGroup>

      {collections.length > 0 && (
        <FilterGroup label={t("collections")}>
          <CheckList
            options={collections.map((entry) => ({
              id: entry.id,
              label: text(entry.name, locale, entry.slug),
              count: entry.product_count,
            }))}
            selected={filters.collectionIds}
            onToggle={(ids) => onChange({ collectionIds: ids })}
          />
        </FilterGroup>
      )}

      {tags.length > 0 && (
        <FilterGroup label={t("tags")}>
          <CheckList
            options={tags.map((entry) => ({
              id: entry.id,
              label: text(entry.name, locale, entry.slug),
              count: entry.products_count ?? null,
            }))}
            selected={filters.tagIds}
            onToggle={(ids) => onChange({ tagIds: ids })}
          />
        </FilterGroup>
      )}
    </div>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-shop-hairline pt-5">
      <p className="font-mono text-[0.6875rem] font-medium tracking-widest text-shop-accent uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function CheckList({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ id: string; label: string; count: number | null }>
  selected: string[]
  onToggle: (ids: string[]) => void
}) {
  return (
    <div className="flex max-h-56 flex-col gap-2.5 overflow-y-auto">
      {options.map((option) => {
        const checked = selected.includes(option.id)
        return (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) =>
                onToggle(
                  next === true
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.count !== null && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {option.count}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

/**
 * A price bound that commits on blur or Enter, not on every keystroke.
 *
 * Uncontrolled by design: the field holds a half-typed "1" on the way to "150",
 * and mirroring that into the URL would refetch the catalogue four times and
 * briefly show the results for `min=1`. `key` reseeds it when the value changes
 * from outside (Clear all), which is the one case the DOM cannot know about.
 */
function PriceInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number | null
  onCommit: (value: number | null) => void
}) {
  function commit(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onCommit(null)
      return
    }
    const parsed = Number(trimmed)
    onCommit(Number.isFinite(parsed) && parsed >= 0 ? parsed : null)
  }

  return (
    <>
      <Label className="sr-only" htmlFor={`price-${label}`}>
        {label}
      </Label>
      <Input
        id={`price-${label}`}
        key={value ?? "empty"}
        type="number"
        inputMode="decimal"
        min={0}
        defaultValue={value ?? ""}
        placeholder={label}
        className="h-9 border-shop-hairline bg-card focus-visible:border-shop-accent"
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(event.currentTarget.value)
          }
        }}
      />
    </>
  )
}
