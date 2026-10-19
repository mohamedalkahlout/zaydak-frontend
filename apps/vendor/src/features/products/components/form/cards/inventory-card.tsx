"use client"

import { Suspense, useState } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { ChevronDown, Info } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"
import { Input } from "@repo/ui/components/input"
import { AppleSwitch } from "@repo/ui/components/apple-switch"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import type { ProductFormApi } from "@/features/products/validations/product"
import { MultiLocationLevels } from "./multi-location-levels"

/**
 * Shopify-parity Inventory card.
 *
 * Tracked (toggle ON): quantity table + collapsible "More details"
 * (SKU + barcode + Sell-when-out-of-stock). When the section is collapsed,
 * it shows summary pills for each field instead of a generic label.
 * Untracked (toggle OFF): only SKU + barcode.
 *
 * Server policy mirrors the UI: track_quantity=false → reservation engine
 * bypasses qty checks; continue_selling_when_out_of_stock=true → allow oversell.
 * Hidden for VARIABLE products — stock is per-variation there.
 */
export function InventoryCard({
  form,
  productId,
}: {
  form: ProductFormApi
  /**
   * Edit-mode only: when present, the quantity row is replaced by a
   * per-location editor backed by `inventory_levels`. Each row fires its
   * own `setInventoryAvailable` mutation on blur — the form's `quantity`
   * field is then ignored for that product (legacy reads still derive
   * `Product.quantity` from SUM(available) via the InventoryService rollup).
   */
  productId?: string
}) {
  const t = useTranslations("products.inventoryCard")
  const {
    register,
    control,
    formState: { errors },
  } = form
  const productType = useWatch({ control, name: "product_type" }) ?? "SIMPLE"
  const tracked = useWatch({ control, name: "track_quantity" }) ?? true
  const oversell =
    useWatch({ control, name: "continue_selling_when_out_of_stock" }) ?? false
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (productType === "VARIABLE") return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <Controller
            control={control}
            name="track_quantity"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {field.value ? t("tracked") : t("notTracked")}
                  {!field.value && (
                    <Info
                      aria-label={t("notTrackedHint")}
                      className="size-3.5 text-muted-foreground/70"
                    />
                  )}
                </span>
                <AppleSwitch
                  checked={!!field.value}
                  onCheckedChange={(v) => field.onChange(!!v)}
                />
              </label>
            )}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {tracked && productId && (
          <Suspense fallback={<LevelsSkeleton />}>
            <MultiLocationLevels productId={productId} />
          </Suspense>
        )}
        {tracked && !productId && (
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <div className="grid grid-cols-[1fr_auto] items-center bg-muted px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
              <span>{t("quantity")}</span>
              <span className="pr-3">{t("quantity")}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-foreground/10 bg-card px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-foreground">
                {t("shopLocation")}
                <AiFilledMark name="quantity" />
              </span>
              <Field className="w-28">
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  className="h-9 text-right tabular-nums"
                  {...register("quantity")}
                />
                <FieldError errors={[errors.quantity]} />
              </Field>
            </div>
          </div>
        )}

        <Collapsible
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          className={cn(tracked && "border-t border-foreground/10 pt-4")}
        >
          <CollapsibleTrigger className="group/inv-trigger flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40">
            {detailsOpen ? (
              <span className="px-1 py-1 font-medium text-foreground">
                {t("moreDetails")}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <SummaryChip>{t("skuChip")}</SummaryChip>
                <SummaryChip>{t("barcodeChip")}</SummaryChip>
                {tracked && (
                  <SummaryChip>
                    <span>{t("sellWhenOutOfStock")}</span>
                    <span className="ml-1 inline-flex h-5 items-center rounded-full bg-card px-2 text-[11px] font-semibold text-foreground/80 ring-1 ring-foreground/10">
                      {oversell ? t("on") : t("off")}
                    </span>
                  </SummaryChip>
                )}
              </div>
            )}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/inv-trigger:text-foreground",
                detailsOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="flex flex-col gap-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="sku">
                    {t("sku")}
                    <AiFilledMark name="sku" />
                  </FieldLabel>
                  <Input
                    id="sku"
                    placeholder="TSHIRT-001"
                    {...register("sku")}
                  />
                  <FieldError errors={[errors.sku]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="barcode">
                    {t("barcode")}
                    <AiFilledMark name="barcode" />
                  </FieldLabel>
                  <Input
                    id="barcode"
                    placeholder="012345678905"
                    {...register("barcode")}
                  />
                  <FieldError errors={[errors.barcode]} />
                </Field>
              </div>

              {tracked && (
                <Controller
                  control={control}
                  name="continue_selling_when_out_of_stock"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                      {t("sellWhenOutOfStock")}
                    </label>
                  )}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

function SummaryChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-3 text-[13px] font-medium text-foreground/85 ring-1 ring-inset ring-foreground/[0.04]">
      {children}
    </span>
  )
}

function LevelsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}
