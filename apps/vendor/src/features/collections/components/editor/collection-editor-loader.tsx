"use client"

import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GET_SHOP_COLLECTION_BY_ID } from "@/features/collections/api"
import type {
  ShopCollection,
  ShopCollectionByIdResponse,
} from "@/features/collections/types"
import { CollectionEditor } from "./collection-editor"

type LoadedCollection = ShopCollection & { pinned_product_ids?: string[] }

/**
 * The edit route's data half. Kept apart from the editor so the editor itself
 * takes a plain collection and can be rendered from a test, or from the create
 * route, with no Apollo around it.
 */
export function CollectionEditorLoader({ id }: { id: string }) {
  const t = useTranslations("collections")
  const { data } = useSuspenseQuery<ShopCollectionByIdResponse>(
    GET_SHOP_COLLECTION_BY_ID,
    { variables: { id } },
  )

  const collection = data?.collection?.data as LoadedCollection | null

  if (!collection) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        {t("notFound")}
      </p>
    )
  }

  return (
    <CollectionEditor
      collection={collection}
      pinnedProductIds={collection.pinned_product_ids ?? []}
    />
  )
}
