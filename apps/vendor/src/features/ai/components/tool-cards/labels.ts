import { useTranslations } from "next-intl"

/**
 * Words for the raw enum values tool results carry.
 *
 * The cards used to print them as they arrived — `publish`, `simple`,
 * `out for delivery` — which is an identifier rather than a label, and English
 * whatever the dashboard's language. These put the product and order screens'
 * own wording on them (`PUBLISH` reads "Active" there, so it does here).
 *
 * A value the catalogue does not know still renders the way it always did, so
 * a status the back-end adds later shows up as itself instead of as a
 * missing-message key.
 */
type Labeller = (value: string) => string

function useEnumLabel(
  namespace: string,
  fallback: (value: string) => string,
): Labeller {
  const t = useTranslations(namespace)
  return (value) => (value && t.has(value) ? t(value) : fallback(value))
}

/** Product `status`: `DRAFT` / `PUBLISH` / `UNLISTED`. */
export function useProductStatusLabel(): Labeller {
  return useEnumLabel("aiChat.toolCards.productStatus", (v) => v.toLowerCase())
}

/** Product `product_type`: `SIMPLE` / `VARIABLE` / `DIGITAL` / `SERVICE`. */
export function useProductTypeLabel(): Labeller {
  return useEnumLabel("aiChat.toolCards.productType", (v) => v.toLowerCase())
}

/** An order status key as `get_shop_stats` returns it (`at_local_facility`). */
export function useOrderStatusLabel(): Labeller {
  return useEnumLabel("aiChat.toolCards.shopStats.status", (v) =>
    v.replace(/_/g, " "),
  )
}

/** Collection `type`. Anything but `MANUAL` is rule-driven, as it always read. */
export function useCollectionTypeLabel(): Labeller {
  const t = useTranslations("aiChat.toolCards.collectionType")
  return (type) => (type === "MANUAL" ? t("MANUAL") : t("AUTOMATED"))
}
