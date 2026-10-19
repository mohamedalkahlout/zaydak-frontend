import { ListIcon, WandSparklesIcon } from "lucide-react"

import type { FilterValueOption } from "@/shared/components/filter-bar"
import type { CollectionType } from "@/features/collections/types"

export const PAGE_SIZE = 6

/**
 * The publish pill, in the two places it is drawn: the list column and the
 * editor's page header. Same tones the products list uses for ACTIVE and
 * ARCHIVED, so a vendor reads one visual language across both screens.
 */
export const PUBLISHED_BADGE_STYLE: Record<"published" | "hidden", string> = {
  published: "bg-emerald-100 text-emerald-900",
  hidden: "bg-zinc-100 text-zinc-700",
}

/**
 * What every collection *picker* asks for. It matches the list table's own
 * variables exactly so a picker reads the table's cached page instead of
 * issuing a second request for the same rows — a different `limit` here would
 * be a different cache entry, which is what made a picker refetch on open.
 */
export const COLLECTIONS_PICKER_VARIABLES = { page: 1, limit: 50 }

/**
 * Where a collection type's words live, as a key rather than the words.
 * Resolved under the `collections` namespace wherever `useTranslations` can be
 * reached, so the filter menu is never the only place the two are spelled out.
 */
export const collectionTypeKey = (type: CollectionType | string) =>
  `type.${type}`

/**
 * The two values `ShopCollection.type` can hold, each with the glyph the list
 * has always drawn it with — and no label, which is a message key derived from
 * the value. They sit here beside the other list constants rather than inline
 * in the toolbar because the filter bar's field definition is what reads them
 * now, and a component is not where a screen keeps the vocabulary its filters
 * are built from.
 */
export const COLLECTION_TYPE_OPTIONS: readonly FilterValueOption<CollectionType>[] =
  [
    { value: "MANUAL", icon: ListIcon },
    { value: "AUTOMATED", icon: WandSparklesIcon },
  ]
