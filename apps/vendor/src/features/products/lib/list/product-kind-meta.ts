import {
  BoxIcon,
  CombineIcon,
  LayersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import type { ProductType } from "@/features/products/types"

/** A picker choice. `ASSEMBLED` is a form, stored as a simple product with composition rules. */
export type ProductKind = ProductType | "ASSEMBLED"

/**
 * The kinds offered by the "Add product" picker, in merchant-priority
 * order. `value` is the URL token the create form reads back from
 * `?kind=` — see `productFormDefaults(kind)`.
 *
 * It carries no copy: the label and description are looked up by the enum
 * (`products.kinds.<VALUE>.{label,description}`), so this stays a plain
 * ordering + icon table that a test or a non-React caller can import without
 * a translator, and neither locale can drift from the other.
 *
 * `VARIABLE` is listed here even though the form never *starts* on it:
 * a product is variable because it has options, not because someone said
 * so, and `useVariantOptions.syncFormVariations` owns that flip. Picking
 * it opens the form on `SIMPLE` with the first option axis already open
 * (`startWithAxis`), and the type settles to `VARIABLE` the moment an
 * axis is committed. Seeding the type directly would let a merchant save
 * a VARIABLE product with no variants, which the server rejects with
 * `VARIABLE_REQUIRES_VARIATIONS`.
 *
 * `DIGITAL` is omitted for V1 (D12): file delivery after payment is not
 * implemented. The API also refuses digital create/sell; re-add the row
 * when OrderedFile issuance ships.
 */
export const PRODUCT_KIND_META: {
  value: ProductKind
  icon: LucideIcon
  /** Small "Most common" pill on the row. Only the default kind carries one. */
  badge?: boolean
}[] = [
  { value: "SIMPLE", icon: BoxIcon, badge: true },
  { value: "ASSEMBLED", icon: CombineIcon },
  { value: "VARIABLE", icon: LayersIcon },
  { value: "SERVICE", icon: WrenchIcon },
]

/** URL tokens are lowercase (`?kind=digital`); the domain type is not. */
export function productKindToParam(kind: ProductKind): string {
  return kind.toLowerCase()
}

/** Reads `?kind=` back, falling back to `SIMPLE` for anything unknown. */
export function parseProductKindParam(raw: string | undefined): ProductKind {
  const match = PRODUCT_KIND_META.find(
    (meta) => productKindToParam(meta.value) === raw?.toLowerCase(),
  )
  return match?.value ?? "SIMPLE"
}
