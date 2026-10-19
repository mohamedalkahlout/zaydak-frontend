"use client"

import { useState } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { ChevronDown, Info } from "lucide-react"
import { AppleSwitch } from "@repo/ui/components/apple-switch"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip"
import { CountrySelect } from "@/shared/geo"
import { cn } from "@/shared/lib/utils"
import {
  WEIGHT_UNIT_LABELS,
  type ProductFormApi,
  type WeightUnit,
} from "@/features/products/validations/product"
import { PackageField } from "./package-field"
import { PackageSuggestTray } from "./package-suggest-tray"

/**
 * Shipping card, shaped like the Inventory card it sits under.
 *
 * `requires_shipping` is the master toggle and lives in the header — when it is
 * off (a digital good or a service) the body is replaced by the sentence saying
 * what that means at checkout. The customs fields sit behind a "More details"
 * collapsible that shows a summary chip per field while closed, because a
 * vendor selling domestically never fills either one.
 *
 * "Suggest a box" is opened from the package field's label row, but its tray
 * belongs to the card: it spans the package and weight columns, which a tray
 * inside one grid cell could not.
 */
const WEIGHT_UNIT_CHOICES: WeightUnit[] = ["KG", "LB", "G", "OZ"]

const DEFAULT_WEIGHT_UNIT: WeightUnit = "KG"

/** Grams per one of each unit. `weight_grams` is the canonical storage. */
const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  G: 1,
  KG: 1000,
  LB: 453.59237,
  OZ: 28.349523125,
}

/**
 * `weight_grams` holds whatever last wrote it — a string while an input is
 * being typed into, a number when seeded from a saved product — so every read
 * normalizes rather than trusting the shape.
 */
function readGrams(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function textToGrams(text: string, unit: WeightUnit): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n * GRAMS_PER_UNIT[unit])
}

function gramsToText(grams: number | undefined, unit: WeightUnit): string {
  if (grams == null) return ""
  // Grams are whole numbers, so three decimals is the most any unit can carry;
  // parseFloat drops the trailing zeros toFixed leaves behind.
  return String(parseFloat((grams / GRAMS_PER_UNIT[unit]).toFixed(3)))
}

export function ShippingCard({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.shipping")
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = form
  const requiresShipping =
    useWatch({ control, name: "requires_shipping" }) ?? true
  const hsCode = useWatch({ control, name: "hs_code" })
  const origin = useWatch({ control, name: "country_of_origin" })
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestedId, setSuggestedId] = useState<string | null>(null)

  const pickSuggested = (packageId: string) => {
    if (getValues("package_id") !== packageId) {
      setValue("package_id", packageId, { shouldDirty: true })
    }
    setSuggestedId(packageId)
    setSuggestOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <Controller
            control={control}
            name="requires_shipping"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                {t("physical")}
                <AppleSwitch
                  checked={field.value ?? true}
                  onCheckedChange={(v) => field.onChange(!!v)}
                />
              </label>
            )}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!requiresShipping && (
          <p className="text-sm text-muted-foreground">{t("notPhysical")}</p>
        )}

        {requiresShipping && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <PackageField
                form={form}
                suggestedId={suggestedId}
                suggestOpen={suggestOpen}
                onSuggestToggle={() => setSuggestOpen((open) => !open)}
              />
              <WeightField form={form} />
            </div>

            {suggestOpen && (
              <PackageSuggestTray
                onPick={pickSuggested}
                onClose={() => setSuggestOpen(false)}
              />
            )}

            <Collapsible
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              className="border-t border-foreground/10 pt-4"
            >
              <CollapsibleTrigger className="group/ship-trigger flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40">
                {detailsOpen ? (
                  <span className="px-1 py-1 font-medium text-foreground">
                    {t("moreDetails")}
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <SummaryChip label={t("originChip")} value={origin} />
                    <SummaryChip label={t("hsCodeChip")} value={hsCode} />
                  </div>
                )}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/ship-trigger:text-foreground",
                    detailsOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="flex flex-col gap-4 pt-4">
                  <DimensionsFields form={form} />

                  <Field>
                    <LabelRow>
                      <FieldLabel id="country_of_origin_label">
                        {t("origin")}
                      </FieldLabel>
                      <FieldHint label={t("originHintLabel")}>
                        {t("originHint")}
                      </FieldHint>
                    </LabelRow>
                    <Controller
                      control={control}
                      name="country_of_origin"
                      render={({ field }) => (
                        <CountrySelect
                          value={(field.value as string | undefined) ?? ""}
                          onChange={field.onChange}
                          labelId="country_of_origin_label"
                        />
                      )}
                    />
                    <FieldError errors={[errors.country_of_origin]} />
                  </Field>

                  <Field>
                    <LabelRow>
                      <FieldLabel htmlFor="hs_code">{t("hsCode")}</FieldLabel>
                      <FieldHint label={t("hsCodeHintLabel")}>
                        {t("hsCodeHint")}
                      </FieldHint>
                    </LabelRow>
                    <Input
                      id="hs_code"
                      placeholder={t("hsCodePlaceholder")}
                      {...register("hs_code")}
                    />
                    <FieldError errors={[errors.hs_code]} />
                  </Field>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Weight and its unit as the one control the design pairs them into.
 *
 * `weight_grams` stays canonical — the vendor types in whichever unit
 * `weight_unit_display` holds and it is converted on the way in. The typed text
 * is mirrored in local state so rounding to whole grams (1.2345 kg stores as
 * 1235 g, which reads back as 1.235 kg) cannot rewrite the box under the
 * cursor. That mirror is re-seeded during render rather than in an effect, and
 * only when the canonical value moved from somewhere other than this input: a
 * form reset, or the unit switching, which re-expresses the same weight.
 */
function WeightField({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.shipping")
  const {
    control,
    setValue,
    formState: { errors },
  } = form
  const grams = readGrams(useWatch({ control, name: "weight_grams" }))
  const unit =
    (useWatch({ control, name: "weight_unit_display" }) as
      | WeightUnit
      | undefined) ?? DEFAULT_WEIGHT_UNIT

  const [text, setText] = useState(() => gramsToText(grams, unit))
  const [seeded, setSeeded] = useState<{
    grams: number | undefined
    unit: WeightUnit
  }>({ grams, unit })

  if (seeded.grams !== grams || seeded.unit !== unit) {
    const external = seeded.unit !== unit || textToGrams(text, unit) !== grams
    setSeeded({ grams, unit })
    if (external) setText(gramsToText(grams, unit))
  }

  return (
    <Field>
      <FieldLabel htmlFor="weight_grams">{t("weight")}</FieldLabel>
      <div className="flex items-start gap-2">
        <Input
          id="weight_grams"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          placeholder="0.0"
          className="flex-1 tabular-nums"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setValue("weight_grams", textToGrams(e.target.value, unit), {
              shouldDirty: true,
            })
          }}
        />
        <Controller
          control={control}
          name="weight_unit_display"
          render={({ field }) => (
            <Select
              value={
                (field.value as WeightUnit | undefined) ?? DEFAULT_WEIGHT_UNIT
              }
              onValueChange={(v) => field.onChange(v as WeightUnit)}
            >
              <SelectTrigger className="w-20 shrink-0" aria-label={t("weightUnit")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEIGHT_UNIT_CHOICES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {WEIGHT_UNIT_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <FieldError errors={[errors.weight_grams]} />
    </Field>
  )
}

function readMm(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function cmToMm(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n * 10)
}

function mmToCm(mm: number | undefined): string {
  if (mm == null) return ""
  return String(parseFloat((mm / 10).toFixed(1)))
}

/**
 * Dimensions (L x W x H) in cm, stored as integer mm.
 * Used by carriers to calculate volumetric weight and select vehicle capacity.
 */
function DimensionsFields({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.shipping")
  const {
    control,
    setValue,
    formState: { errors },
  } = form

  const lengthMm = readMm(useWatch({ control, name: "length_mm" }))
  const widthMm = readMm(useWatch({ control, name: "width_mm" }))
  const heightMm = readMm(useWatch({ control, name: "height_mm" }))

  const [lengthText, setLengthText] = useState(() => mmToCm(lengthMm))
  const [widthText, setWidthText] = useState(() => mmToCm(widthMm))
  const [heightText, setHeightText] = useState(() => mmToCm(heightMm))

  const [seeded, setSeeded] = useState<{
    lengthMm: number | undefined
    widthMm: number | undefined
    heightMm: number | undefined
  }>({ lengthMm, widthMm, heightMm })

  if (
    seeded.lengthMm !== lengthMm ||
    seeded.widthMm !== widthMm ||
    seeded.heightMm !== heightMm
  ) {
    const extL = cmToMm(lengthText) !== lengthMm
    const extW = cmToMm(widthText) !== widthMm
    const extH = cmToMm(heightText) !== heightMm
    setSeeded({ lengthMm, widthMm, heightMm })
    if (extL) setLengthText(mmToCm(lengthMm))
    if (extW) setWidthText(mmToCm(widthMm))
    if (extH) setHeightText(mmToCm(heightMm))
  }

  return (
    <Field>
      <LabelRow>
        <FieldLabel htmlFor="length_cm">{t("dimensions")}</FieldLabel>
        <FieldHint label={t("dimensionsHintLabel")}>
          {t("dimensionsHint")}
        </FieldHint>
      </LabelRow>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Input
            id="length_cm"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder={t("length")}
            className="tabular-nums text-xs sm:text-sm"
            value={lengthText}
            onChange={(e) => {
              setLengthText(e.target.value)
              setValue("length_mm", cmToMm(e.target.value), {
                shouldDirty: true,
              })
            }}
          />
          <span className="px-1 text-[11px] text-muted-foreground">
            {t("lengthCaption")}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            id="width_cm"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder={t("width")}
            aria-label={t("width")}
            className="tabular-nums text-xs sm:text-sm"
            value={widthText}
            onChange={(e) => {
              setWidthText(e.target.value)
              setValue("width_mm", cmToMm(e.target.value), {
                shouldDirty: true,
              })
            }}
          />
          <span className="px-1 text-[11px] text-muted-foreground">
            {t("widthCaption")}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            id="height_cm"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder={t("height")}
            aria-label={t("height")}
            className="tabular-nums text-xs sm:text-sm"
            value={heightText}
            onChange={(e) => {
              setHeightText(e.target.value)
              setValue("height_mm", cmToMm(e.target.value), {
                shouldDirty: true,
              })
            }}
          />
          <span className="px-1 text-[11px] text-muted-foreground">
            {t("heightCaption")}
          </span>
        </div>
      </div>
      <FieldError
        errors={[errors.length_mm, errors.width_mm, errors.height_mm]}
      />
    </Field>
  )
}

/**
 * Label and its info icon as siblings rather than nesting the icon inside the
 * `<label>` — a button in there is a second click target for the field, and
 * makes the label ambiguous to `getByLabelText` and to a screen reader alike.
 */
function LabelRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5">{children}</div>
}

/**
 * The "what is this field for" copy the design puts behind an icon. The trigger
 * is a real focusable button carrying the field's name, so the tooltip is
 * reachable from the keyboard instead of being hover-only decoration.
 */
function FieldHint({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex cursor-help items-center rounded-full text-muted-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Info aria-hidden className="size-3.5" />
          </button>
        }
      />
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Closed-state summary of one field inside "More details" — the label alone
 * when empty, the label plus its value once set, so collapsing the section
 * never hides a filled field behind a generic heading.
 */
function SummaryChip({ label, value }: { label: string; value?: unknown }) {
  const filled = typeof value === "string" && value.trim().length > 0
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-3 text-[13px] font-medium text-foreground/85 ring-1 ring-inset ring-foreground/[0.04]">
      <span>{label}</span>
      {filled && (
        <span className="ms-1 inline-flex h-5 max-w-32 items-center truncate rounded-full bg-card px-2 text-[11px] font-semibold text-foreground/80 ring-1 ring-foreground/10">
          {(value as string).trim()}
        </span>
      )}
    </span>
  )
}
