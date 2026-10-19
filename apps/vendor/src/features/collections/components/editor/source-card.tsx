"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"
import { CirclePlusIcon, PackagePlusIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Separator } from "@repo/ui/components/separator"
import {
  CONDITION_FIELDS,
  EXCLUSION_FIELDS,
  newCondition,
} from "@/features/collections/lib/rules"
import type {
  CollectionFormApi,
  SourceInput,
} from "@/features/collections/validations/shop-collection"
import { ConditionRow, type ConditionPath } from "./condition-row"
import { CollectionPickerDialog } from "./collection-picker-dialog"
import { ProductPickerDialog } from "./product-picker-dialog"
import { useCollectionOptions } from "./use-collection-options"

/**
 * One source: where a slice of the collection's items comes from. Products
 * sources select by condition and take hand-picked additions; collections
 * sources pull in the members of other collections. Each carries its own
 * exclusions, and those beat every inclusion on the card and off it.
 */
export function SourceCard({
  form,
  index,
  onRemove,
  canRemove,
  canAddCondition,
  ownsManualPicks,
  collectionId,
}: {
  form: CollectionFormApi
  index: number
  onRemove: () => void
  canRemove: boolean
  /**
   * False once the collection holds the API's 60-condition budget. The panel
   * decides it, not the card — the budget is per collection, so one card
   * cannot know from its own rows whether the next one is allowed.
   */
  canAddCondition: boolean
  /** Hand-picked products are one set per collection; one card offers them. */
  ownsManualPicks: boolean
  collectionId?: string
}) {
  const t = useTranslations("collections")
  const { labelOf } = useCollectionOptions()
  const [productsOpen, setProductsOpen] = useState(false)
  const [excludeProductsOpen, setExcludeProductsOpen] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [excludeCollectionsOpen, setExcludeCollectionsOpen] = useState(false)

  const source = useWatch({
    control: form.control,
    name: `sources.${index}`,
  }) as SourceInput | undefined
  const manualIds = (useWatch({
    control: form.control,
    name: "product_ids",
  }) ?? []) as string[]

  if (!source) return null

  const set = (next: Partial<SourceInput>) =>
    form.setValue(
      `sources.${index}`,
      { ...source, ...next },
      { shouldDirty: true },
    )

  const setExclude = (next: Partial<SourceInput["exclude"]>) =>
    set({ exclude: { ...source.exclude, ...next } })

  const hasExclusions =
    source.exclude.conditions.length > 0 ||
    source.exclude.product_ids.length > 0 ||
    source.exclude.collection_ids.length > 0

  return (
    <div className="rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2">
        <Select
          value={source.kind}
          onValueChange={(value) =>
            set({
              kind: value as SourceInput["kind"],
              // The two kinds hold different selections; keep neither when
              // switching, so nothing invisible is submitted.
              conditions: [],
              collection_ids: [],
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1.5 border-0 bg-transparent px-1.5 font-medium shadow-none hover:bg-muted"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRODUCTS">{t("sources.products")}</SelectItem>
            <SelectItem value="COLLECTIONS">
              {t("sources.collections")}
            </SelectItem>
          </SelectContent>
        </Select>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ms-auto size-7 text-muted-foreground hover:text-destructive"
            aria-label={t("sources.removeSource")}
            onClick={onRemove}
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {source.kind === "PRODUCTS" ? (
          <>
            {source.conditions.length > 1 && (
              <Select
                value={source.match}
                onValueChange={(value) =>
                  set({ match: value as SourceInput["match"] })
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("sources.matchAll")}</SelectItem>
                  <SelectItem value="ANY">{t("sources.matchAny")}</SelectItem>
                </SelectContent>
              </Select>
            )}

            {source.conditions.map((_, conditionIndex) => (
              <ConditionRow
                key={`condition-${conditionIndex}`}
                form={form}
                path={
                  `sources.${index}.conditions.${conditionIndex}` as ConditionPath
                }
                fields={CONDITION_FIELDS}
                onRemove={() =>
                  set({
                    conditions: source.conditions.filter(
                      (_, i) => i !== conditionIndex,
                    ),
                  })
                }
              />
            ))}

            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={!canAddCondition}
                onClick={() =>
                  set({ conditions: [...source.conditions, newCondition()] })
                }
              >
                <CirclePlusIcon className="size-3.5" />
                {t("sources.addCondition")}
              </Button>
              {ownsManualPicks && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setProductsOpen(true)}
                >
                  <PackagePlusIcon className="size-3.5" />
                  {t("sources.addProducts")}
                </Button>
              )}
            </div>

            {ownsManualPicks && manualIds.length > 0 && (
              <button
                type="button"
                onClick={() => setProductsOpen(true)}
                className="rounded-md bg-muted/60 px-2.5 py-1.5 text-start text-xs text-muted-foreground transition hover:bg-muted"
              >
                {t("sources.manualChosen", { count: manualIds.length })}
              </button>
            )}
          </>
        ) : (
          <>
            <IdChips
              ids={source.collection_ids}
              labelOf={labelOf}
              onRemove={(id) =>
                set({
                  collection_ids: source.collection_ids.filter(
                    (value) => value !== id,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 self-start text-xs"
              onClick={() => setCollectionsOpen(true)}
            >
              <CirclePlusIcon className="size-3.5" />
              {t("sources.pickCollections")}
            </Button>
          </>
        )}
      </div>

      <Separator className="my-3" />

      {hasExclusions ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("sources.excludedTitle")}
          </p>

          {source.exclude.conditions.map((_, conditionIndex) => (
            <ConditionRow
              key={`exclude-${conditionIndex}`}
              form={form}
              path={
                `sources.${index}.exclude.conditions.${conditionIndex}` as ConditionPath
              }
              fields={EXCLUSION_FIELDS}
              onRemove={() =>
                setExclude({
                  conditions: source.exclude.conditions.filter(
                    (_, i) => i !== conditionIndex,
                  ),
                })
              }
            />
          ))}

          {source.exclude.product_ids.length > 0 && (
            <button
              type="button"
              onClick={() => setExcludeProductsOpen(true)}
              className="rounded-md bg-muted/60 px-2.5 py-1.5 text-start text-xs text-muted-foreground transition hover:bg-muted"
            >
              {t("picker.productCount", {
                count: source.exclude.product_ids.length,
              })}
            </button>
          )}

          <IdChips
            ids={source.exclude.collection_ids}
            labelOf={labelOf}
            onRemove={(id) =>
              setExclude({
                collection_ids: source.exclude.collection_ids.filter(
                  (value) => value !== id,
                ),
              })
            }
          />

          <p className="text-[11px] text-muted-foreground">
            {t("sources.excludedHint")}
          </p>
        </div>
      ) : null}

      <ExcludeMenu
        canAddCondition={canAddCondition}
        onCondition={() =>
          setExclude({
            conditions: [
              ...source.exclude.conditions,
              newCondition("system_category_id"),
            ],
          })
        }
        onProducts={() => setExcludeProductsOpen(true)}
        onCollections={() => setExcludeCollectionsOpen(true)}
      />

      <ProductPickerDialog
        open={productsOpen}
        onOpenChange={setProductsOpen}
        value={manualIds}
        onConfirm={(ids) =>
          form.setValue("product_ids", ids, { shouldDirty: true })
        }
      />
      <ProductPickerDialog
        mode="exclude"
        open={excludeProductsOpen}
        onOpenChange={setExcludeProductsOpen}
        value={source.exclude.product_ids}
        onConfirm={(ids) => setExclude({ product_ids: ids })}
      />
      <CollectionPickerDialog
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
        value={source.collection_ids}
        excludeId={collectionId}
        onConfirm={(ids) => set({ collection_ids: ids })}
      />
      <CollectionPickerDialog
        mode="exclude"
        open={excludeCollectionsOpen}
        onOpenChange={setExcludeCollectionsOpen}
        value={source.exclude.collection_ids}
        excludeId={collectionId}
        onConfirm={(ids) => setExclude({ collection_ids: ids })}
      />
    </div>
  )
}

function ExcludeMenu({
  canAddCondition,
  onCondition,
  onProducts,
  onCollections,
}: {
  /** An exclusion condition spends the same budget as a source condition. */
  canAddCondition: boolean
  onCondition: () => void
  onProducts: () => void
  onCollections: () => void
}) {
  const t = useTranslations("collections.sources")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-8 gap-1.5 text-xs"
          >
            <CirclePlusIcon className="size-3.5" />
            {t("exclude")}
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem disabled={!canAddCondition} onClick={onCondition}>
          {t("excludeCondition")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onProducts}>
          {t("excludeProducts")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCollections}>
          {t("excludeCollections")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function IdChips({
  ids,
  labelOf,
  onRemove,
}: {
  ids: string[]
  labelOf: (id: string) => string
  onRemove: (id: string) => void
}) {
  if (ids.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
        >
          <span className="max-w-40 truncate">{labelOf(id)}</span>
          <button
            type="button"
            className="text-muted-foreground transition hover:text-destructive"
            onClick={() => onRemove(id)}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
