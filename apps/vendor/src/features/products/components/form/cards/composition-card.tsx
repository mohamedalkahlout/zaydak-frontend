"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { GET_PRODUCTS, GET_PRODUCT_COMPOSITION } from "@/features/products/api"
import type { ProductsResponse } from "@/features/products/types"
import type { ProductFormApi } from "@/features/products/validations/product"
import { titleIn } from "@/features/ai/lib/live-form"
import { centsToMajor, majorToCents } from "@/shared/lib/format"
import { SectionCard } from "../ui/section-card"

export type CompositionPricing = "ladder" | "flat" | "each"

export type CompositionPartDraft = {
  product_id: string
  name: string
  addon: string
  cutout: string
}

export type CompositionGroupDraft = {
  key: string
  label: string
  pricing: CompositionPricing
  min_count: number
  max_count: number
  addon: string
  parts: CompositionPartDraft[]
}

export type CompositionDraft = {
  enabled: boolean
  min_count: number
  max_count: number
  vessel_cap: number
  ladder: string[]
  groups: CompositionGroupDraft[]
}

function blankLadder(max: number, prev: string[] = []): string[] {
  return ["0", ...Array.from({ length: max }, (_, i) => prev[i + 1] ?? "")]
}

function nextKey(groups: CompositionGroupDraft[]): string {
  let n = groups.length + 1
  let key = `choice_${n}`
  while (groups.some((group) => group.key === key)) {
    n += 1
    key = `choice_${n}`
  }
  return key
}

const LADDER_GROUP: CompositionGroupDraft = {
  key: "choice",
  label: "",
  pricing: "ladder",
  min_count: 1,
  max_count: 1,
  addon: "",
  parts: [],
}

export const EMPTY_COMPOSITION: CompositionDraft = {
  enabled: false,
  min_count: 1,
  max_count: 1,
  vessel_cap: 1,
  ladder: blankLadder(1),
  groups: [{ ...LADDER_GROUP, parts: [] }],
}

/** What the assembled-product form opens on. The price is one step until the merchant raises the maximum. */
export const ASSEMBLED_COMPOSITION: CompositionDraft = {
  ...EMPTY_COMPOSITION,
  enabled: true,
  groups: [{ ...LADDER_GROUP, parts: [] }],
}

export function compositionDraftsEqual(a: CompositionDraft, b: CompositionDraft) {
  return JSON.stringify(a) === JSON.stringify(b)
}

type LoadedComposition = {
  min_count: number
  max_count: number
  vessel_cap: number
  price_ladder_cents: number[]
  groups: Array<{
    key: string
    label?: string | null
    priced_by_ladder: boolean
    selection: string
    min_count: number
    max_count: number
    addon_cents: number
    parts: Array<{ product_id: string; addon_cents: number; cutout_url?: string | null }>
  }>
}

function pricingOf(group: LoadedComposition["groups"][number]): CompositionPricing {
  if (group.priced_by_ladder) return "ladder"
  if (group.parts.some((part) => part.addon_cents > 0)) return "each"
  return "flat"
}

export function compositionInput(draft: CompositionDraft, productId: string) {
  const capFollowsMax = draft.vessel_cap >= draft.max_count
  return {
    product_id: productId,
    min_count: draft.min_count,
    max_count: draft.max_count,
    vessel_cap: capFollowsMax ? draft.max_count : Math.min(draft.vessel_cap, draft.max_count),
    price_ladder_cents: draft.ladder.map((value) => majorToCents(Number(value) || 0)),
    groups: draft.groups.map((group) => ({
      key: group.key,
      label: group.label.trim(),
      priced_by_ladder: group.pricing === "ladder",
      selection: group.max_count <= 1 ? "SINGLE" : "MULTI",
      min_count: group.pricing === "ladder" ? draft.min_count : group.min_count,
      max_count: group.pricing === "ladder" ? draft.max_count : group.max_count,
      addon_cents: group.pricing === "flat" ? majorToCents(Number(group.addon) || 0) : 0,
      parts: group.parts.map((part) => ({
        product_id: part.product_id,
        addon_cents: group.pricing === "each" ? majorToCents(Number(part.addon) || 0) : 0,
        cutout_url: part.cutout.trim() || null,
      })),
    })),
  }
}

function fromLoaded(row: LoadedComposition, names: Map<string, string>): CompositionDraft {
  const ladderGroup = row.groups.find((group) => group.priced_by_ladder)
  return {
    enabled: true,
    min_count: row.min_count,
    max_count: row.max_count,
    vessel_cap: row.vessel_cap,
    ladder: blankLadder(row.max_count).map((value, index) =>
      row.price_ladder_cents[index] != null
        ? String(centsToMajor(row.price_ladder_cents[index]))
        : value,
    ),
    groups: row.groups.map((group) => ({
      key: group.key,
      label: group.label?.trim() || (group.key === ladderGroup?.key ? "" : group.key),
      pricing: pricingOf(group),
      min_count: group.min_count,
      max_count: group.max_count,
      addon: group.addon_cents ? String(centsToMajor(group.addon_cents)) : "",
      parts: group.parts.map((part) => ({
        product_id: part.product_id,
        name: names.get(part.product_id) ?? part.product_id,
        addon: part.addon_cents ? String(centsToMajor(part.addon_cents)) : "",
        cutout: part.cutout_url ?? "",
      })),
    })),
  }
}

function writeCataloguePrice(form: ProductFormApi, draft: CompositionDraft) {
  const step = draft.ladder[draft.min_count]
  if (step == null || step.trim() === "") return
  const major = Number(step)
  if (!Number.isFinite(major)) return
  form.setValue("price", major, { shouldDirty: true, shouldValidate: true })
}

export function AssemblyBuilder({
  form,
  productId,
  draft,
  baseline,
  onChange,
  onBaseline,
}: {
  form: ProductFormApi
  productId?: string
  draft: CompositionDraft
  baseline: CompositionDraft
  onChange: (next: CompositionDraft) => void
  onBaseline: (next: CompositionDraft) => void
}) {
  const t = useTranslations("products.compositionCard")
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [seeded, setSeeded] = useState<string | null>(null)

  const loaded = useQuery(GET_PRODUCT_COMPOSITION, {
    variables: { product_id: productId ?? "" },
    skip: !productId,
    fetchPolicy: "network-only",
  })
  const row = loaded.data?.productComposition?.data ?? null
  const partIds = row?.groups.flatMap((group) => group.parts.map((part) => part.product_id)) ?? []
  const namesQuery = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: { filters: { ids: partIds, limit: partIds.length || 1 } },
    skip: !row || partIds.length === 0,
  })
  const seedToken = row ? row.product_id + ":" + row.groups.map((group) => group.key).join(",") : null
  if (productId && seedToken && seeded !== seedToken && !loaded.loading) {
    const names = new Map<string, string>()
    for (const product of namesQuery.data?.products?.data ?? []) {
      names.set(product.id, titleIn(product.name, locale) ?? product.slug)
    }
    const namesReady = partIds.every((id) => names.has(id) || namesQuery.loading === false)
    if (namesReady && row) {
      setSeeded(seedToken)
      const next = fromLoaded(row, names)
      if (compositionDraftsEqual(draft, baseline)) {
        onChange(next)
        onBaseline(next)
      } else {
        onBaseline(next)
      }
    }
  }

  const search = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: { filters: { search: query, limit: 8 } },
    skip: query.trim().length < 2,
  })

  const patch = (next: CompositionDraft) => {
    onChange(next)
    writeCataloguePrice(form, next)
  }

  const ladder = draft.groups.find((group) => group.pricing === "ladder") ?? draft.groups[0]
  const extras = draft.groups.filter((group) => group.key !== ladder?.key)

  const updateGroup = (key: string, recipe: (group: CompositionGroupDraft) => CompositionGroupDraft) => {
    patch({
      ...draft,
      groups: draft.groups.map((group) => (group.key === key ? recipe(group) : group)),
    })
  }

  const setBounds = (min: number, max: number) => {
    const boundedMax = Math.min(20, Math.max(min, max))
    const capFollows = draft.vessel_cap >= draft.max_count
    patch({
      ...draft,
      min_count: min,
      max_count: boundedMax,
      vessel_cap: capFollows ? boundedMax : Math.min(draft.vessel_cap, boundedMax),
      ladder: blankLadder(boundedMax, draft.ladder),
      groups: draft.groups.map((group) =>
        group.pricing === "ladder" ? { ...group, min_count: min, max_count: boundedMax } : group,
      ),
    })
  }

  const usedIds = new Set(draft.groups.flatMap((group) => group.parts.map((part) => part.product_id)))
  const results = (search.data?.products?.data ?? []).filter(
    (product) =>
      product.id !== productId &&
      !usedIds.has(product.id) &&
      (product.product_type === "SIMPLE" || product.product_type === "SERVICE"),
  )

  return (
    <>
      <SectionCard title={t("priceTitle")} subtitle={t("priceHint")}>
        {ladder ? (
          <GroupEditor
            group={ladder}
            ladder
            draft={draft}
            query={query}
            active={activeKey === ladder.key}
            results={results}
            searching={query.trim().length >= 2}
            onQuery={(value) => {
              setActiveKey(ladder.key)
              setQuery(value)
            }}
            onLabel={(label) => updateGroup(ladder.key, (group) => ({ ...group, label }))}
            onBounds={setBounds}
            onLadder={(index, value) => {
              const next = [...draft.ladder]
              next[index] = value
              patch({ ...draft, ladder: next })
            }}
            onRemovePart={(product_id) =>
              updateGroup(ladder.key, (group) => ({
                ...group,
                parts: group.parts.filter((part) => part.product_id !== product_id),
              }))
            }
            onPartCutout={(product_id, cutout) =>
              updateGroup(ladder.key, (group) => ({
                ...group,
                parts: group.parts.map((part) =>
                  part.product_id === product_id ? { ...part, cutout } : part,
                ),
              }))
            }
            onAddPart={(product) => {
              updateGroup(ladder.key, (group) => ({
                ...group,
                parts: [
                  ...group.parts,
                  {
                    product_id: product.id,
                    name: titleIn(product.name, locale) ?? product.slug,
                    addon: "",
                    cutout: "",
                  },
                ],
              }))
              setQuery("")
            }}
          />
        ) : null}
      </SectionCard>

      <SectionCard
        title={t("extrasTitle")}
        subtitle={t("extrasHint")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                ...draft,
                groups: [
                  ...draft.groups,
                  {
                    key: nextKey(draft.groups),
                    label: "",
                    pricing: "flat",
                    min_count: 0,
                    max_count: 1,
                    addon: "",
                    parts: [],
                  },
                ],
              })
            }
          >
            {t("addGroup")}
          </Button>
        }
      >
        {extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("extrasEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {extras.map((group) => (
              <GroupEditor
                key={group.key}
                group={group}
                draft={draft}
                query={query}
                active={activeKey === group.key}
                results={results.filter(
                  (product) => !group.parts.some((part) => part.product_id === product.id),
                )}
                searching={query.trim().length >= 2}
                onQuery={(value) => {
                  setActiveKey(group.key)
                  setQuery(value)
                }}
                onLabel={(label) => updateGroup(group.key, (item) => ({ ...item, label }))}
                onPricing={(pricing) => updateGroup(group.key, (item) => ({ ...item, pricing }))}
                onExtraBounds={(min, max) =>
                  updateGroup(group.key, (item) => ({
                    ...item,
                    min_count: min,
                    max_count: Math.min(20, Math.max(min, max)),
                  }))
                }
                onAddon={(addon) => updateGroup(group.key, (item) => ({ ...item, addon }))}
                onPartAddon={(product_id, addon) =>
                  updateGroup(group.key, (item) => ({
                    ...item,
                    parts: item.parts.map((part) =>
                      part.product_id === product_id ? { ...part, addon } : part,
                    ),
                  }))
                }
                onRemovePart={(product_id) =>
                  updateGroup(group.key, (item) => ({
                    ...item,
                    parts: item.parts.filter((part) => part.product_id !== product_id),
                  }))
                }
                onPartCutout={(product_id, cutout) =>
                  updateGroup(group.key, (item) => ({
                    ...item,
                    parts: item.parts.map((part) =>
                      part.product_id === product_id ? { ...part, cutout } : part,
                    ),
                  }))
                }
                onRemoveGroup={() =>
                  patch({ ...draft, groups: draft.groups.filter((item) => item.key !== group.key) })
                }
                onAddPart={(product) => {
                  updateGroup(group.key, (item) => ({
                    ...item,
                    parts: [
                      ...item.parts,
                      {
                        product_id: product.id,
                        name: titleIn(product.name, locale) ?? product.slug,
                        addon: "",
                        cutout: "",
                      },
                    ],
                  }))
                  setQuery("")
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

type SearchProduct = {
  id: string
  slug: string
  name: unknown
  product_type: string
}

function GroupEditor({
  group,
  ladder,
  draft,
  query,
  active,
  results,
  searching,
  onQuery,
  onLabel,
  onBounds,
  onLadder,
  onPricing,
  onExtraBounds,
  onAddon,
  onPartAddon,
  onPartCutout,
  onRemovePart,
  onRemoveGroup,
  onAddPart,
}: {
  group: CompositionGroupDraft
  ladder?: boolean
  draft: CompositionDraft
  query: string
  active: boolean
  results: SearchProduct[]
  searching: boolean
  onQuery: (value: string) => void
  onLabel: (value: string) => void
  onBounds?: (min: number, max: number) => void
  onLadder?: (index: number, value: string) => void
  onPricing?: (pricing: CompositionPricing) => void
  onExtraBounds?: (min: number, max: number) => void
  onAddon?: (value: string) => void
  onPartAddon?: (productId: string, value: string) => void
  onPartCutout?: (productId: string, value: string) => void
  onRemovePart: (productId: string) => void
  onRemoveGroup?: () => void
  onAddPart: (product: SearchProduct) => void
}) {
  const t = useTranslations("products.compositionCard")
  const locale = useLocale()
  const min = ladder ? draft.min_count : group.min_count
  const max = ladder ? draft.max_count : group.max_count
  const taken = new Set(group.parts.map((part) => part.product_id))
  const choices = results.filter((product) => !taken.has(product.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          {t("choiceName")}
          <Input
            value={group.label}
            placeholder={t("choiceNamePlaceholder")}
            maxLength={80}
            onChange={(event) => onLabel(event.target.value)}
          />
        </label>
        {onRemoveGroup ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemoveGroup}>
            {t("removeGroup")}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("atLeast")}
          <Input
            type="number"
            min={ladder ? 1 : 0}
            value={min}
            onChange={(event) => {
              const nextMin = Math.max(ladder ? 1 : 0, Number(event.target.value) || 0)
              if (ladder && onBounds) onBounds(Math.min(nextMin, max), max)
              else onExtraBounds?.(Math.min(nextMin, max), max)
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("atMost")}
          <Input
            type="number"
            min={min}
            max={20}
            value={max}
            onChange={(event) => {
              const nextMax = Number(event.target.value) || min
              if (ladder && onBounds) onBounds(min, nextMax)
              else onExtraBounds?.(min, nextMax)
            }}
          />
        </label>
        {ladder && max === 1 ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            {t("price")}
            <Input
              inputMode="decimal"
              value={draft.ladder[1] ?? ""}
              onChange={(event) => onLadder?.(1, event.target.value)}
            />
          </label>
        ) : null}
        {!ladder && group.pricing === "flat" ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            {t("extraPrice")}
            <Input
              inputMode="decimal"
              value={group.addon}
              onChange={(event) => onAddon?.(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      {ladder && max > 1 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {draft.ladder.slice(1, max + 1).map((value, index) => (
            <label key={index} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("priceFor", { count: index + 1 })}
              <Input
                inputMode="decimal"
                value={value}
                onChange={(event) => onLadder?.(index + 1, event.target.value)}
              />
            </label>
          ))}
        </div>
      ) : null}

      {!ladder && onPricing ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={group.pricing === "flat" ? "secondary" : "outline"}
            aria-pressed={group.pricing === "flat"}
            onClick={() => onPricing("flat")}
          >
            {t("flat")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={group.pricing === "each" ? "secondary" : "outline"}
            aria-pressed={group.pricing === "each"}
            onClick={() => onPricing("each")}
          >
            {t("each")}
          </Button>
        </div>
      ) : null}

      {group.parts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyChoices")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {group.parts.map((part) => (
            <li key={part.product_id} className="flex flex-col gap-2 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{part.name}</span>
                {group.pricing === "each" ? (
                  <Input
                    inputMode="decimal"
                    className="w-24"
                    aria-label={t("optionPrice")}
                    value={part.addon}
                    onChange={(event) => onPartAddon?.(part.product_id, event.target.value)}
                  />
                ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemovePart(part.product_id)}
              >
                {t("remove")}
              </Button>
              </div>
              <Input
                value={part.cutout}
                placeholder={t("cutoutPlaceholder")}
                aria-label={t("cutout")}
                onChange={(event) => onPartCutout?.(part.product_id, event.target.value)}
              />
            </li>
          ))}
        </ul>
      )}

      <Input
        value={active ? query : ""}
        placeholder={t("search")}
        onFocus={() => onQuery(active ? query : "")}
        onChange={(event) => onQuery(event.target.value)}
      />
      {active && searching ? (
        choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
        ) : (
          <ul className="flex flex-col">
            {choices.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                  onClick={() => onAddPart(product)}
                >
                  {titleIn(product.name, locale) ?? product.slug}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
