"use client"

/**
 * Product-form negotiation policy card (V1).
 *
 * Shown when sale_type is NEGOTIABLE. Stages policy locally; parent form
 * save bar persists via `upsertNegotiationPolicy` (see use-product-submit).
 * Floor preview is vendor-only — never ship `effective_floor_cents` to the
 * storefront.
 *
 * Gated on plan entitlement `ai.negotiation` (same key as `@RequireFeature`
 * on the resolver). The policies query is skipped when the plan excludes it,
 * so the console never logs FEATURE_NOT_AVAILABLE on every product edit.
 */

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"
import { Label } from "@repo/ui/components/label"
import type { ProductFormApi } from "@/features/products/validations/product"
import { useWatch } from "react-hook-form"
import {
  NEGOTIATION_POLICIES,
  PREVIEW_NEGOTIATION_FLOOR,
} from "@/features/negotiation/api"
import { useFeature } from "@/features/plan/lib/use-feature"
import { useEffect, useState } from "react"

export type NegotiationFloorMode =
  | "max_discount"
  | "min_price"
  | "min_margin"
  | "advanced"

export type NegotiationDraft = {
  enabled: boolean
  floor_mode: NegotiationFloorMode
  strategy: "conservative" | "balanced" | "aggressive"
  minimum_price_cents: number | null
  max_discount_bps: number | null
  minimum_margin_bps: number | null
  preferred_price_cents: number | null
  max_rounds: number
  offer_ttl_seconds: number
  allow_coupon_stacking: boolean
  /**
   * The saved options of a product sold in options that keep a fixed price —
   * sorted, so two drafts naming the same ones compare equal. Every other
   * option negotiates under the settings above.
   */
  excluded_variation_ids: string[]
  /**
   * Saved options with a minimum selling price of their own, in cents, by
   * option id. One amount cannot fit options priced differently; a discount
   * or a margin already scales with each option's price, so the minimum price
   * is the one thing an option overrides. An option absent here follows the
   * product's floor.
   */
  option_floors: Record<string, number>
}

export const DEFAULT_NEGOTIATION_DRAFT: NegotiationDraft = {
  enabled: true,
  floor_mode: "max_discount",
  strategy: "balanced",
  minimum_price_cents: null,
  max_discount_bps: 1500,
  minimum_margin_bps: null,
  preferred_price_cents: null,
  max_rounds: 5,
  offer_ttl_seconds: 1800,
  allow_coupon_stacking: false,
  excluded_variation_ids: [],
  option_floors: {},
}

/** An order-free reading of the per-option floors, for comparing two drafts. */
function floorsKey(floors: Record<string, number>): string {
  return Object.entries(floors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, cents]) => `${id}=${cents}`)
    .join()
}

export function draftsEqual(a: NegotiationDraft, b: NegotiationDraft): boolean {
  return (
    a.enabled === b.enabled &&
    a.floor_mode === b.floor_mode &&
    a.strategy === b.strategy &&
    a.minimum_price_cents === b.minimum_price_cents &&
    a.max_discount_bps === b.max_discount_bps &&
    a.minimum_margin_bps === b.minimum_margin_bps &&
    a.preferred_price_cents === b.preferred_price_cents &&
    a.max_rounds === b.max_rounds &&
    a.offer_ttl_seconds === b.offer_ttl_seconds &&
    a.allow_coupon_stacking === b.allow_coupon_stacking &&
    a.excluded_variation_ids.join() === b.excluded_variation_ids.join() &&
    floorsKey(a.option_floors) === floorsKey(b.option_floors)
  )
}

function policyToDraft(row: {
  enabled: boolean
  floor_mode: string
  strategy: string
  minimum_price_cents?: number | null
  max_discount_bps?: number | null
  minimum_margin_bps?: number | null
  preferred_price_cents?: number | null
  max_rounds: number
  offer_ttl_seconds: number
  allow_coupon_stacking: boolean
}): NegotiationDraft {
  return {
    enabled: row.enabled,
    floor_mode: row.floor_mode as NegotiationFloorMode,
    strategy: row.strategy as NegotiationDraft["strategy"],
    minimum_price_cents: row.minimum_price_cents ?? null,
    max_discount_bps: row.max_discount_bps ?? null,
    minimum_margin_bps: row.minimum_margin_bps ?? null,
    preferred_price_cents: row.preferred_price_cents ?? null,
    max_rounds: row.max_rounds,
    offer_ttl_seconds: row.offer_ttl_seconds,
    allow_coupon_stacking: row.allow_coupon_stacking,
    excluded_variation_ids: [],
    option_floors: {},
  }
}

/**
 * The options kept at a fixed price, from the product's policy rows: an
 * option's own row switched off is what takes it out (the server's rule —
 * see `NegotiationService.resolveEnabledPolicy`).
 */
function excludedFromRows(
  rows: ReadonlyArray<{ variation_option_id?: string | null; enabled: boolean }>,
): string[] {
  return rows
    .filter((r) => r.variation_option_id && !r.enabled)
    .map((r) => r.variation_option_id as string)
    .sort()
}

/**
 * The options with a minimum price of their own: an option's row switched on
 * and carrying one. A row given only a discount of its own (the variants
 * table's bulk policy) is not one, and saving the card leaves it alone.
 */
export function floorsFromRows(
  rows: ReadonlyArray<{
    variation_option_id?: string | null
    enabled: boolean
    minimum_price_cents?: number | null
  }>,
): Record<string, number> {
  const floors: Record<string, number> = {}
  for (const r of rows) {
    if (r.variation_option_id && r.enabled && r.minimum_price_cents != null) {
      floors[r.variation_option_id] = r.minimum_price_cents
    }
  }
  return floors
}

/**
 * An option as the merchant named it: its title in the dashboard's language,
 * else in the other one, else its values ("Red / M").
 */
function optionLabel(
  option: {
    title?: Partial<Record<string, string>> | null
    options?: Record<string, string> | null
  },
  locale: string,
  index: number,
): string {
  const title = option.title ?? {}
  const own =
    title[locale]?.trim() ||
    Object.values(title).find((s) => typeof s === "string" && s.trim())?.trim()
  if (own) return own
  const values = Object.values(option.options ?? {}).filter(Boolean)
  return values.length > 0 ? values.join(" / ") : `#${index + 1}`
}

function centsToText(cents: number | null): string {
  return cents != null ? (cents / 100).toFixed(2) : ""
}

function textToCents(text: string): number | null {
  if (!text.trim()) return null
  const n = Number(text)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/**
 * The typed text is kept as-is while the field has focus and only normalised
 * to two decimals on blur. Deriving `value` from cents on every keystroke
 * turned "1" into "1.00" before the next digit landed, so "12" was untypable.
 * A cents change from outside (server seed, Discard) still resyncs the text.
 */
function MinimumPriceInput({
  cents,
  onChange,
  id = "minimum_price",
  className,
  placeholder,
  "aria-label": ariaLabel,
}: {
  cents: number | null
  onChange: (cents: number | null) => void
  id?: string
  className?: string
  placeholder?: string
  "aria-label"?: string
}) {
  const [text, setText] = useState(() => centsToText(cents))
  const [syncedCents, setSyncedCents] = useState(cents)
  if (cents !== syncedCents) {
    setSyncedCents(cents)
    setText(centsToText(cents))
  }

  return (
    <Input
      id={id}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      type="number"
      inputMode="decimal"
      step="0.01"
      min={0}
      value={text}
      onChange={(e) => {
        const next = textToCents(e.target.value)
        setText(e.target.value)
        setSyncedCents(next)
        onChange(next)
      }}
      onBlur={() => setText(centsToText(syncedCents))}
    />
  )
}

export function NegotiationCard({
  form,
  productId,
  draft,
  onChange,
  onBaselineChange,
  locale = "en",
}: {
  form: ProductFormApi
  productId?: string
  draft: NegotiationDraft
  onChange: (next: NegotiationDraft) => void
  /** Server (or default) baseline so the parent can compute value-based dirty. */
  onBaselineChange: (baseline: NegotiationDraft) => void
  /** Which language to name the product's options in. */
  locale?: string
}) {
  const t = useTranslations("negotiation")
  const saleType = useWatch({ control: form.control, name: "sale_type" }) ?? "FIXED_PRICE"
  const productType = useWatch({ control: form.control, name: "product_type" })
  const variationRows =
    useWatch({ control: form.control, name: "variation_options" }) ?? []
  // Only a saved option has an id to keep out; one added in this edit
  // negotiates until the product is saved, and can be switched off after.
  const savedOptions = variationRows.flatMap((v, index) =>
    v.id ? [{ id: v.id, label: optionLabel(v, locale, index) }] : [],
  )
  const unsavedOptions = variationRows.length - savedOptions.length
  const feature = useFeature("ai.negotiation")
  const [seededProductId, setSeededProductId] = useState<string | null>(
    productId ? null : "__create__",
  )

  const policiesEnabled =
    !!productId &&
    saleType === "NEGOTIABLE" &&
    feature.allowed &&
    !feature.loading

  const { data, loading } = useQuery(NEGOTIATION_POLICIES, {
    variables: { product_id: productId! },
    skip: !policiesEnabled,
    fetchPolicy: "cache-and-network",
  })

  const canPreview = policiesEnabled && draft.enabled
  const { data: previewData, loading: previewLoading } = useQuery(
    PREVIEW_NEGOTIATION_FLOOR,
    {
      variables: {
        input: {
          product_id: productId!,
          minimum_price_cents: draft.minimum_price_cents,
          max_discount_bps: draft.max_discount_bps,
          minimum_margin_bps: draft.minimum_margin_bps,
        },
      },
      skip: !canPreview,
      fetchPolicy: "cache-and-network",
    },
  )
  const floorPreview = previewData?.previewNegotiationFloor?.data

  // Seed parent draft/baseline once per product after policies resolve.
  // Parent updates must run in an effect — adjust-state-during-render is only
  // safe for *this* component's state, and calling ProductFormBody setters
  // mid-render throws "Cannot update a component while rendering a different
  // component".
  useEffect(() => {
    if (!policiesEnabled || !productId || seededProductId === productId) return

    const rows = data?.negotiationPolicies?.data
    if (rows) {
      // The product's own row holds the settings; an option's row says
      // whether that option is out, or what minimum price it has of its own.
      const productLevel = rows.find(
        (p: { variation_option_id?: string | null }) => !p.variation_option_id,
      )
      const next = {
        ...(productLevel
          ? policyToDraft(productLevel)
          : DEFAULT_NEGOTIATION_DRAFT),
        excluded_variation_ids: excludedFromRows(rows),
        option_floors: floorsFromRows(rows),
      }
      queueMicrotask(() => {
        setSeededProductId(productId)
        onChange(next)
        onBaselineChange(next)
      })
      return
    }

    if (!loading) {
      queueMicrotask(() => {
        setSeededProductId(productId)
        onChange(DEFAULT_NEGOTIATION_DRAFT)
        onBaselineChange(DEFAULT_NEGOTIATION_DRAFT)
      })
    }
  }, [
    policiesEnabled,
    productId,
    seededProductId,
    data,
    loading,
    onChange,
    onBaselineChange,
  ])

  if (saleType !== "NEGOTIABLE") return null

  // Entitlements still resolving — stay quiet rather than flash the form then
  // yank it, or fire a query that FeatureGuard will refuse.
  if (feature.loading) return null

  if (!feature.allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("notOnPlan")}</p>
        </CardContent>
      </Card>
    )
  }

  function patch(partial: Partial<NegotiationDraft>) {
    onChange({ ...draft, ...partial })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="neg-enabled">{t("enabled")}</Label>
          <Switch
            id="neg-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => patch({ enabled })}
          />
        </div>

        {draft.enabled && productType === "VARIABLE" && variationRows.length > 0 && (
          <Field>
            <FieldLabel>{t("optionsTitle")}</FieldLabel>
            <p className="text-xs text-muted-foreground">{t("optionsHint")}</p>
            {savedOptions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("optionFloorHint")}
              </p>
            )}
            {savedOptions.length > 0 && (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
                {savedOptions.map((option) => {
                  const negotiates = !draft.excluded_variation_ids.includes(
                    option.id,
                  )
                  return (
                    <div
                      key={option.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <Label
                        htmlFor={`neg-option-${option.id}`}
                        className="min-w-0 flex-1 font-normal"
                      >
                        {option.label}
                      </Label>
                      {/* An option kept at a fixed price has no floor to
                          set, and the server never saves one for it. */}
                      {negotiates && (
                        <MinimumPriceInput
                          id={`neg-option-floor-${option.id}`}
                          className="h-8 w-28"
                          placeholder={t("optionFloorPlaceholder")}
                          aria-label={t("optionFloorLabel", {
                            option: option.label,
                          })}
                          cents={draft.option_floors[option.id] ?? null}
                          onChange={(cents) => {
                            const option_floors = { ...draft.option_floors }
                            if (cents == null) delete option_floors[option.id]
                            else option_floors[option.id] = cents
                            patch({ option_floors })
                          }}
                        />
                      )}
                      <Switch
                        id={`neg-option-${option.id}`}
                        checked={negotiates}
                        onCheckedChange={(on) =>
                          patch({
                            excluded_variation_ids: on
                              ? draft.excluded_variation_ids.filter(
                                  (id) => id !== option.id,
                                )
                              : [...draft.excluded_variation_ids, option.id].sort(),
                          })
                        }
                      />
                    </div>
                  )
                })}
              </div>
            )}
            {unsavedOptions > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("optionsUnsaved", { count: unsavedOptions })}
              </p>
            )}
          </Field>
        )}

        <Field>
          <FieldLabel>{t("floorMode")}</FieldLabel>
          <div className="flex flex-col gap-2 text-sm">
            {(
              [
                ["max_discount", t("modeMaxDiscount")],
                ["min_price", t("modeMinPrice")],
                ["min_margin", t("modeMinMargin")],
                ["advanced", t("modeAdvanced")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="floor_mode"
                  checked={draft.floor_mode === value}
                  onChange={() => patch({ floor_mode: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>

        {(draft.floor_mode === "max_discount" ||
          draft.floor_mode === "advanced") && (
          <Field>
            <FieldLabel htmlFor="max_discount_bps">
              {t("maxDiscountBps")}
            </FieldLabel>
            <Input
              id="max_discount_bps"
              type="number"
              min={0}
              max={10000}
              value={draft.max_discount_bps ?? ""}
              onChange={(e) =>
                patch({
                  max_discount_bps: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </Field>
        )}

        {(draft.floor_mode === "min_price" ||
          draft.floor_mode === "advanced") && (
          <Field>
            <FieldLabel htmlFor="minimum_price">
              {t("minimumPrice")}
            </FieldLabel>
            <MinimumPriceInput
              cents={draft.minimum_price_cents}
              onChange={(minimum_price_cents) => patch({ minimum_price_cents })}
            />
          </Field>
        )}

        {(draft.floor_mode === "min_margin" ||
          draft.floor_mode === "advanced") && (
          <Field>
            <FieldLabel htmlFor="minimum_margin_bps">
              {t("minimumMarginBps")}
            </FieldLabel>
            <Input
              id="minimum_margin_bps"
              type="number"
              min={0}
              max={9999}
              value={draft.minimum_margin_bps ?? ""}
              onChange={(e) =>
                patch({
                  minimum_margin_bps: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="max_rounds">{t("maxRounds")}</FieldLabel>
          <Input
            id="max_rounds"
            type="number"
            min={1}
            max={20}
            value={draft.max_rounds}
            onChange={(e) =>
              patch({ max_rounds: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>

        <Field>
          <FieldLabel>{t("strategy")}</FieldLabel>
          <div className="flex flex-col gap-2 text-sm">
            {(
              [
                ["conservative", t("strategyConservative")],
                ["balanced", t("strategyBalanced")],
                ["aggressive", t("strategyAggressive")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="strategy"
                  checked={draft.strategy === value}
                  onChange={() => patch({ strategy: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="offer_ttl">{t("offerTtlMinutes")}</FieldLabel>
          <Input
            id="offer_ttl"
            type="number"
            min={1}
            max={10080}
            value={Math.round(draft.offer_ttl_seconds / 60)}
            onChange={(e) =>
              patch({
                offer_ttl_seconds: Math.max(60, (Number(e.target.value) || 1) * 60),
              })
            }
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="coupon-stacking">{t("allowCouponStacking")}</Label>
          <Switch
            id="coupon-stacking"
            checked={draft.allow_coupon_stacking}
            onCheckedChange={(allow_coupon_stacking) =>
              patch({ allow_coupon_stacking })
            }
          />
        </div>

        {draft.enabled && (
          <div className="rounded-xl border border-shop-hairline bg-muted/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {t("liveFloorPreview")}
              </span>
              {previewLoading ? (
                <span className="text-xs text-muted-foreground">{t("calculating")}</span>
              ) : floorPreview?.effective_floor_cents != null ? (
                <span className="font-heading font-bold text-sm text-shop-accent tabular-nums">
                  {(floorPreview.effective_floor_cents / 100).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            {floorPreview && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-shop-hairline/60 text-[11px] text-muted-foreground">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">{t("fromMaxDiscount")}</span>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    {(floorPreview.from_max_discount_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">{t("fromMinPrice")}</span>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    {(floorPreview.from_minimum_price_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">{t("fromMinMargin")}</span>
                  <span className="font-mono tabular-nums font-medium text-foreground">
                    {(floorPreview.from_minimum_margin_cents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("floorHint")}</p>
      </CardContent>
    </Card>
  )
}
