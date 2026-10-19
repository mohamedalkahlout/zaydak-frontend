"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"
import {
  COUNTRIES,
  SA_REGIONS,
  foldSearch,
  geoLabel,
  loadSaCities,
  loadSaDistricts,
  resolveCountry,
  type SaCity,
  type SaDistrict,
} from "./data"

/**
 * The three address pickers, all one combobox underneath.
 *
 * They filter themselves (`shouldFilter={false}`) rather than letting cmdk do
 * it, for the same reason the taxonomy picker does: cmdk scores every mounted
 * item, and the Saudi tables run to 15,513 cities and 21,235 districts. Ours folds Arabic and Latin
 * onto common ground first (see `foldSearch`) and stops at `MAX_VISIBLE` — and
 * the list says how many it left out rather than looking complete.
 */
const MAX_VISIBLE = 60

interface Option {
  /**
   * React key. The stored value is not one: 532 Saudi city names and far more
   * district names repeat, so two rows can share an English name.
   */
  id: string
  /** Stored value — an ISO2 code for countries, an English name otherwise. */
  key: string
  label: string
  /** Rendered before the label (a flag emoji). */
  prefix?: string
  /** The strings a query is matched against, already folded. */
  haystack: string[]
}

function GeoCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  loading,
  labelId,
}: {
  options: Option[]
  value: string
  onChange: (key: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  loading?: boolean
  labelId?: string
}) {
  const t = useTranslations("geo")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")

  const selected = options.find((o) => o.key === value)

  const { visible, total } = useMemo(() => {
    const query = foldSearch(q)
    if (!query) {
      return { visible: options.slice(0, MAX_VISIBLE), total: options.length }
    }
    const matches: Option[] = []
    let count = 0
    for (const o of options) {
      if (!o.haystack.some((h) => h.includes(query))) continue
      count += 1
      if (matches.length < MAX_VISIBLE) matches.push(o)
    }
    return { visible: matches, total: count }
  }, [options, q])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled || loading}
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-labelledby={labelId}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {selected?.prefix && (
                <span aria-hidden className="shrink-0">
                  {selected.prefix}
                </span>
              )}
              <span className="truncate">
                {loading
                  ? tCommon("loading")
                  : (selected?.label ?? (value || placeholder))}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      />
      <PopoverContent
        align="start"
        aria-label={searchPlaceholder}
        className="w-(--anchor-width) min-w-64 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {visible.map((o) => (
              <CommandItem
                key={o.id}
                value={o.key}
                onSelect={() => {
                  onChange(o.key)
                  setOpen(false)
                  setQ("")
                }}
                data-checked={o.key === value}
              >
                {o.prefix && (
                  <span aria-hidden className="shrink-0">
                    {o.prefix}
                  </span>
                )}
                <span
                  className={cn(
                    "truncate",
                    o.key === value && "font-medium text-foreground",
                  )}
                >
                  {o.label}
                </span>
              </CommandItem>
            ))}
            {total > visible.length && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("moreResults", { count: total - visible.length })}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Country picker. `value` is — and `onChange` emits — an ISO 3166-1 alpha-2 code. */
export function CountrySelect({
  value,
  onChange,
  labelId,
}: {
  value: string
  onChange: (code: string) => void
  labelId?: string
}) {
  const t = useTranslations("geo")
  const locale = useLocale()

  // A shop saved before this field became a code holds a display name; resolve
  // it so the picker shows it as chosen rather than as free text.
  const code = resolveCountry(value)?.code ?? value

  const options = useMemo<Option[]>(
    () =>
      COUNTRIES.map((c) => ({
        id: c.code,
        key: c.code,
        label: geoLabel(c, locale),
        prefix: c.flag,
        // Both names and the code, so someone on the Arabic locale can still
        // type "Saudi" and land on السعودية.
        haystack: [foldSearch(c.en), foldSearch(c.ar), c.code.toLowerCase()],
      })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  )

  return (
    <GeoCombobox
      options={options}
      value={code}
      onChange={onChange}
      placeholder={t("selectCountry")}
      searchPlaceholder={t("searchCountry")}
      emptyLabel={t("noCountry")}
      labelId={labelId}
    />
  )
}

/**
 * Saudi region picker. Stores the region's **English** name, because that is
 * what `ShopLocation.state` is: one string a carrier or an export reads, and
 * it must not change meaning when the vendor flips the dashboard to Arabic.
 * The label is localized on the way out only.
 */
export function SaRegionSelect({
  value,
  onChange,
  labelId,
}: {
  value: string
  onChange: (regionEn: string) => void
  labelId?: string
}) {
  const t = useTranslations("geo")
  const locale = useLocale()

  const options = useMemo<Option[]>(
    () =>
      SA_REGIONS.map((r) => ({
        id: String(r.id),
        key: r.en,
        label: geoLabel(r, locale),
        haystack: [foldSearch(r.en), foldSearch(r.ar)],
      })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  )

  return (
    <GeoCombobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("selectRegion")}
      searchPlaceholder={t("searchRegion")}
      emptyLabel={t("noRegion")}
      labelId={labelId}
    />
  )
}

/**
 * Saudi city picker — narrowed to `regionEn` when one is chosen, offering all
 * 15,513 otherwise, because a vendor who knows their city but not which of the
 * 13 regions holds it should not be stuck behind the region field.
 */
export function SaCitySelect({
  regionEn,
  value,
  onChange,
  labelId,
}: {
  regionEn: string
  value: string
  onChange: (cityEn: string) => void
  labelId?: string
}) {
  const t = useTranslations("geo")
  const locale = useLocale()
  const [cities, setCities] = useState<SaCity[] | null>(null)

  useEffect(() => {
    let alive = true
    void loadSaCities().then((rows) => {
      if (alive) setCities(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  const regionId = useMemo(
    () => SA_REGIONS.find((r) => r.en === regionEn)?.id ?? null,
    [regionEn],
  )

  const options = useMemo<Option[]>(() => {
    if (!cities) return []
    const scoped =
      regionId == null ? cities : cities.filter((c) => c.region === regionId)
    return scoped
      .map((c) => ({
        id: String(c.id),
        key: c.en,
        label: geoLabel(c, locale),
        haystack: [foldSearch(c.en), foldSearch(c.ar)],
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [cities, regionId, locale])

  return (
    <GeoCombobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("selectCity")}
      searchPlaceholder={t("searchCity")}
      emptyLabel={t("noCity")}
      loading={cities === null}
      labelId={labelId}
    />
  )
}

/**
 * Saudi district picker (حي). Stores the English name, like the city. Narrowed
 * to the chosen city, else to the region, else all 21,235. The city is found
 * by English name *within the region*: 532 names repeat across the table, and
 * the first match anywhere would offer another city's districts.
 */
export function SaDistrictSelect({
  regionEn,
  cityEn,
  value,
  onChange,
  labelId,
}: {
  regionEn?: string
  cityEn?: string
  value: string
  onChange: (districtEn: string) => void
  labelId?: string
}) {
  const t = useTranslations("geo")
  const locale = useLocale()
  const [districts, setDistricts] = useState<SaDistrict[] | null>(null)
  const [cities, setCities] = useState<SaCity[] | null>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([loadSaDistricts(), loadSaCities()]).then(
      ([dRows, cRows]) => {
        if (alive) {
          setDistricts(dRows)
          setCities(cRows)
        }
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const regionId = useMemo(
    () =>
      regionEn ? (SA_REGIONS.find((r) => r.en === regionEn)?.id ?? null) : null,
    [regionEn],
  )

  const cityId = useMemo(() => {
    if (!cityEn || !cities) return null
    return (
      cities.find(
        (c) => c.en === cityEn && (regionId == null || c.region === regionId),
      )?.id ?? null
    )
  }, [cityEn, cities, regionId])

  const options = useMemo<Option[]>(() => {
    if (!districts) return []
    let scoped = districts
    if (cityId != null) {
      scoped = scoped.filter((d) => d.city === cityId)
    } else if (regionId != null) {
      scoped = scoped.filter((d) => d.region === regionId)
    }
    return scoped
      .map((d) => ({
        id: String(d.id),
        key: d.en,
        label: geoLabel(d, locale),
        haystack: [foldSearch(d.en), foldSearch(d.ar)],
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [districts, cityId, regionId, locale])

  return (
    <GeoCombobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={t("selectDistrict")}
      searchPlaceholder={t("searchDistrict")}
      emptyLabel={t("noDistrict")}
      loading={districts === null}
      labelId={labelId}
    />
  )
}
