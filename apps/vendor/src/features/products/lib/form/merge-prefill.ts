import {
  mergePrefill,
  proposedFromPrefill as proposedFrom,
} from "@/shared/lib/merge-prefill"

/**
 * The product form's binding of `@/shared/lib/merge-prefill`: the handoff
 * prefill over the row (edit) or the kind's defaults (create), one level
 * deep except the `{ en, ar }` fields below, which merge per locale. See the
 * shared module for why — `update_product` renaming only the Arabic title
 * used to blank the English one on the edit form.
 */

/** The product form's `{ en, ar }` fields. */
export const PREFILL_TRANSLATABLE_FIELDS = [
  "name",
  "description",
  "seo_title",
  "seo_description",
] as const

export function mergeProductPrefill<T extends object>(
  base: T,
  prefill: Record<string, unknown> | undefined,
): T {
  return mergePrefill(base, prefill, PREFILL_TRANSLATABLE_FIELDS)
}

/** What the marks compare against — see the shared module. */
export function proposedFromPrefill(
  merged: object,
  prefill: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return proposedFrom(merged, prefill, PREFILL_TRANSLATABLE_FIELDS)
}
