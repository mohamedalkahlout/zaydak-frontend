import { cap, stagePatch, type PatchSpec } from "@/features/ai/lib/live-form"
import { COLLECTION_TRANSLATABLE_FIELDS } from "@/features/collections/lib/rules"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"

/**
 * The collection create form as a live form: what it tells the assistant on
 * each message, and how a `patch_form` result is staged back into it.
 *
 * The lists MIRROR the back-end's (`sanitizeCollectionValues` in
 * `back-end/src/vendor-agent/tools/lib/live-form.ts`, `COLLECTION_PATCH_FIELDS`
 * in `patch-collection-form.tool.ts`). The back-end is not a workspace, so the
 * two cannot share an import; the server re-checks everything this side sends.
 *
 * Text only: a collection's cover, its conditions and its hand-picked
 * products are not something a message can state, and stay on the form.
 */

const CAPS = { name: 120, description: 160, slug: 80 } as const

/** Collection form fields `patch_form` may write. */
export const COLLECTION_PATCH_FIELDS: readonly string[] = [
  "name",
  "description",
  "seo_title",
  "seo_description",
  "slug",
]

/** The blank each field the server may empty is written as. Not the title:
 * the form requires one. */
export const COLLECTION_CLEARED_VALUE: Readonly<Record<string, unknown>> = {
  description: { en: "", ar: "" },
  seo_title: { en: "", ar: "" },
  seo_description: { en: "", ar: "" },
  slug: "",
}

const COLLECTION_PATCH_SPEC: PatchSpec = {
  fields: new Set(COLLECTION_PATCH_FIELDS),
  // Merged per locale, like the handoff prefill: a title the assistant gives
  // in one language never blanks the other.
  translatable: new Set<string>(COLLECTION_TRANSLATABLE_FIELDS),
  blanks: COLLECTION_CLEARED_VALUE,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function translatable(
  value: unknown,
  max: number,
): Record<string, string> | undefined {
  if (!isPlainObject(value)) return undefined
  const out: Record<string, string> = {}
  for (const locale of ["en", "ar"] as const) {
    const text = value[locale]
    if (typeof text === "string" && text.trim()) {
      out[locale] = cap(text.trim(), max)
    }
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * The form's values, reduced to what the assistant is told: the title, the
 * description and the handle, long text capped and empty fields left out. The
 * SEO pair is patchable but not sent, to keep the prompt small.
 */
export function collectionSnapshot(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const name = translatable(values.name, CAPS.name)
  if (name) out.name = name
  const description = translatable(values.description, CAPS.description)
  if (description) out.description = description
  if (typeof values.slug === "string" && values.slug.trim()) {
    out.slug = cap(values.slug.trim(), CAPS.slug)
  }
  return out
}

/**
 * Stage a patch into the collection form: `setValue` with `shouldDirty`, so
 * the form turns dirty and nothing is saved until the vendor presses Save.
 */
export function applyCollectionPatch(
  form: Pick<CollectionFormApi, "getValues" | "setValue" | "trigger">,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return stagePatch(form as never, values, COLLECTION_PATCH_SPEC)
}
