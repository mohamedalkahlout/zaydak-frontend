"use client"

import { useMemo } from "react"
import { useQuery } from "@apollo/client/react"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type { ShopCollectionsResponse } from "@/features/collections/types"
import { collectionName } from "@/features/collections/lib/list/helpers"

/**
 * Names for the collection ids a source or an exclusion holds. The list query
 * is already in the Apollo cache from the collections table, so this is a read
 * rather than a round trip in the common path.
 */
export function useCollectionOptions() {
  const { data } = useQuery<ShopCollectionsResponse>(GET_SHOP_COLLECTIONS, {
    variables: { page: 1, limit: 50 },
    fetchPolicy: "cache-first",
  })

  const byId = useMemo(
    () =>
      new Map(
        (data?.collections?.data ?? []).map((collection) => [
          collection.id,
          collectionName(collection.name) || collection.slug,
        ]),
      ),
    [data],
  )

  return {
    /** Falls back to the id so a stale reference is still removable. */
    labelOf: (id: string) => byId.get(id) ?? id,
  }
}
