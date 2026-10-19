"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { useQuery } from "@apollo/client/react"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import {
  CollectionCreateDialog,
  type CreatedCollection,
} from "@/features/collections/components/collection-create-dialog"
import { COLLECTIONS_PICKER_VARIABLES } from "@/features/collections/lib/list/constants"
import { collectionName } from "@/features/collections/lib/list/helpers"
import type { ShopCollectionsResponse } from "@/features/collections/types"
import type { ProductFormApi } from "@/features/products/validations/product"
import { ChipPicker, type PickerGroup } from "./chip-picker"

/**
 * The product's collections, staged like every other field on the form — the
 * membership is written by the product's own save, not here.
 *
 * Creating a collection is the exception, and it has to be: a collection is a
 * row of its own, so "Add collection" writes one immediately and the picker
 * only selects what came back. That is why it opens a drawer rather than
 * navigating — the product being edited has unsaved changes on screen.
 */
export function CollectionPicker({
  form,
  snapshots,
}: {
  form: ProductFormApi
  snapshots?: Record<string, string>
}) {
  const t = useTranslations("products.collections")
  const [createOpen, setCreateOpen] = useState(false)
  /** Labels for collections created here, so a chip renders before the refetch. */
  const [created, setCreated] = useState<Record<string, string>>({})

  const { data } = useQuery<ShopCollectionsResponse>(GET_SHOP_COLLECTIONS, {
    variables: COLLECTIONS_PICKER_VARIABLES,
    fetchPolicy: "cache-first",
  })

  const groups = useMemo<PickerGroup[]>(() => {
    const options = (data?.collections?.data ?? [])
      .map((c) => ({
        id: c.id,
        label: collectionName(c.name) || c.slug,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return [{ options }]
  }, [data])

  return (
    <Controller
      control={form.control}
      name="collection_ids"
      render={({ field }) => {
        const value = (field.value as string[]) ?? []
        const select = (collection: CreatedCollection) => {
          setCreated((prev) => ({ ...prev, [collection.id]: collection.label }))
          if (!value.includes(collection.id)) {
            field.onChange([...value, collection.id])
          }
        }

        return (
          <>
            <ChipPicker
              label={t("label")}
              addLabel={t("add")}
              value={value}
              onChange={(ids) => field.onChange(ids)}
              groups={groups}
              snapshots={{ ...snapshots, ...created }}
              searchPlaceholder={t("search")}
              footerAction={{
                label: t("addNew"),
                onSelect: () => setCreateOpen(true),
              }}
            />

            {/*
              Rendered beside the picker rather than inside its panel: the panel
              closes when this opens, and a drawer unmounted mid-animation by
              its own trigger disappearing never plays its transition.
            */}
            <CollectionCreateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              onCreated={select}
            />
          </>
        )
      }}
    />
  )
}
