"use client"

import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import type { ProductFormApi } from "@/features/products/validations/product"
import { OptionAxisRow } from "../variants/option-axis-row"
import type { VariantOptionsApi } from "../variants/use-variant-options"
import { VariantsTable } from "../variants/variants-table"

/**
 * Shopify-style variants card.
 *
 * Empty state: a single "Add options like size or color" call-to-action.
 * Once the first option is added, the card expands into an editable list
 * (one row per axis) plus a variants table showing the cartesian product.
 *
 * The card auto-syncs `product_type` to `VARIABLE` once any committed
 * axis exists, and back to `SIMPLE` if the last axis is removed — see
 * `useVariantOptions.syncFormVariations`.
 */
export function VariantsCard({
  form,
  variants,
  productId,
}: {
  form: ProductFormApi
  variants: VariantOptionsApi
  /**
   * Edit-mode only. Hands the variants table a saved product to read stock
   * against, which is what turns its Available column into a per-location
   * one. On create there is nothing to read and nowhere to choose: the
   * opening quantity is seeded at the shop's default location.
   */
  productId?: string
}) {
  const t = useTranslations("products.variantsCard")
  const {
    axes,
    hasCommittedAxes,
    addAxis,
    removeAxis,
    startEdit,
    cancelEdit,
    setDraftName,
    setDraftValues,
    commitAxis,
    disconnectAttribute,
  } = variants

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {axes.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={addAxis}
            className="h-10 w-full justify-start gap-2 text-muted-foreground"
          >
            <PlusIcon className="size-4" />
            {t("addOptions")}
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-md border">
              {axes.map((axis, i) => (
                <div
                  key={axis.id}
                  className={i > 0 ? "border-t" : undefined}
                >
                  <OptionAxisRow
                    axis={axis}
                    onStartEdit={() => startEdit(axis.id)}
                    onCancelEdit={() => cancelEdit(axis.id)}
                    onDelete={() => removeAxis(axis.id)}
                    onDone={() => commitAxis(axis.id)}
                    onDraftNameChange={(name) => setDraftName(axis.id, name)}
                    onDraftValuesChange={(values) =>
                      setDraftValues(axis.id, values)
                    }
                    onDisconnect={
                      axis.connectedAttribute
                        ? () =>
                            disconnectAttribute(
                              axis.connectedAttribute!.key,
                            )
                        : undefined
                    }
                  />
                </div>
              ))}
              <div className="border-t">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={addAxis}
                  className="h-11 w-full justify-start gap-2 rounded-none text-muted-foreground"
                >
                  <PlusIcon className="size-4" />
                  {t("addAnother")}
                </Button>
              </div>
            </div>

            {hasCommittedAxes && (
              <VariantsTable form={form} axes={axes} productId={productId} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
