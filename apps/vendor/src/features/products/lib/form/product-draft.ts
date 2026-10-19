import {
  productTypeSchema,
  type ProductFormInput,
} from "@/features/products/validations/product"
import type { ProductKind } from "@/features/products/lib/list/product-kind-meta"

/**
 * A create-form draft, parked in `sessionStorage` between a reload and the
 * next mount.
 *
 * Session storage, not local — the same reasoning as the signup wizard: a
 * half-written product belongs to this tab and this sitting. It survives the
 * reload that a "check the SKU in the other system" detour causes, and is
 * gone once the tab is. Keyed per shop so a draft started on one storefront
 * cannot surface on another the same vendor owns.
 *
 * `kind` is stored beside the values because the values alone cannot say
 * it: "Product with options" never seeds a type (`productFormDefaults`), it
 * opens the variants editor through `startWithAxis`, and a VARIABLE draft
 * with no axis committed yet is indistinguishable from a simple product
 * without it.
 */
export interface ProductDraft {
  kind: ProductKind
  values: ProductFormInput
  /** Epoch milliseconds of the write, so a draft can be aged. */
  saved_at: number
  /**
   * The assistant handoff the form was opened from, when it was one. Such a
   * draft belongs to that ticket and ends with it (`draftOutlivedHandoff`):
   * left untagged, a form the assistant prepared and then patched — dirty, so
   * parked — came back as a "restored draft" on the vendor's next manual
   * "Add product", long after they had walked away from it.
   */
  handoff_id?: string
}

const KEY_PREFIX = "vendor-product-draft:"

export function productDraftKey(shopSlug: string): string {
  return `${KEY_PREFIX}${shopSlug}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * The parked draft, or `null` when there is none — or when what is there
 * was truncated or hand-edited into a shape the form cannot seed from. A
 * bad entry is dropped rather than restored: an unknown `kind` would
 * otherwise reach `productFormDefaults` and seed a physical product under
 * a download's values.
 */
export function readProductDraft(shopSlug: string): ProductDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(productDraftKey(shopSlug))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const { kind, values, saved_at, handoff_id } = parsed
    if (
      kind !== "ASSEMBLED" &&
      !productTypeSchema.safeParse(kind).success
    ) {
      return null
    }
    if (!isRecord(values)) return null
    if (typeof saved_at !== "number" || !Number.isFinite(saved_at)) return null
    return {
      kind: kind as ProductKind,
      values: values as ProductFormInput,
      saved_at,
      ...(typeof handoff_id === "string" && handoff_id ? { handoff_id } : {}),
    }
  } catch {
    return null
  }
}

/**
 * Whether a parked draft belongs to an assistant handoff that has ended.
 *
 * `pendingHandoffId` is the create ticket still in the store, read without
 * the TTL: a reload keeps the ticket (no unmount ran to release it), so a
 * draft whose ticket is still there is the same sitting coming back, even
 * once the ticket has expired; a draft whose ticket was saved, released or
 * replaced is not. An untagged draft — a form the vendor opened themselves —
 * never outlives anything.
 */
export function draftOutlivedHandoff(
  draft: ProductDraft,
  pendingHandoffId: string | undefined,
): boolean {
  return draft.handoff_id !== undefined && draft.handoff_id !== pendingHandoffId
}

/** Parks a draft. A full or blocked quota costs the vendor a refresh, nothing more. */
export function writeProductDraft(shopSlug: string, draft: ProductDraft): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      productDraftKey(shopSlug),
      JSON.stringify(draft),
    )
  } catch {
    // Quota exceeded or storage blocked — the form still holds the values.
  }
}

export function clearProductDraft(shopSlug: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(productDraftKey(shopSlug))
  } catch {
    // Ignored for the same reason as the write.
  }
}
