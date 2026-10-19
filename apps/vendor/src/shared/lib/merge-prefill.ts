/**
 * How an assistant handoff's prefill becomes a form's starting values, and
 * what the "Filled by Sidekick" marks compare against — for any form whose
 * `{ en, ar }` fields the caller names.
 *
 * The prefill used to be spread over the base one level deep
 * (`{ ...base, ...prefill }`). That is right for a price, and wrong for a
 * `{ en, ar }` field: `update_product` renaming only the Arabic title sent
 * `name: { en: "", ar: "…" }`, and the English title on the edit form went
 * blank — the same for the description and the SEO pair. The tools now send
 * only the locale they were given, and this merges a translatable per
 * locale, so neither shape can blank the other locale: turns persisted
 * before the tools changed still carry the empty one.
 *
 * Product and collection forms each bind their own field list
 * (`features/products/lib/form/merge-prefill.ts`, `features/collections/lib/rules.ts`).
 */

export type TranslatableFields = ReadonlyArray<string> | ReadonlySet<string>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const isBlank = (value: unknown) =>
  typeof value !== "string" || value.trim() === ""

const asSet = (fields: TranslatableFields): ReadonlySet<string> =>
  fields instanceof Set ? fields : new Set(fields as ReadonlyArray<string>)

/** Whether a prefilled translatable proposes any locale at all. */
function proposesText(value: Record<string, unknown>): boolean {
  return Object.values(value).some((locale) => !isBlank(locale))
}

/**
 * A prefilled translatable merged over the form's own value, per locale. A
 * locale the prefill leaves out, or sends blank, keeps the base's text; a
 * blank one still fills a locale the base has no text for, so an empty pair
 * over an empty pair stays exactly what it was.
 */
function mergeLocales(
  base: unknown,
  change: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = isPlainObject(base) ? { ...base } : {}
  for (const [locale, text] of Object.entries(change)) {
    if (typeof text !== "string") continue
    if (isBlank(text) && !isBlank(out[locale])) continue
    out[locale] = text
  }
  return out
}

/**
 * The form's starting values: `prefill` over `base` (the server row on edit,
 * the defaults on create). One level deep, as before, except the named
 * `{ en, ar }` fields, which merge per locale.
 */
export function mergePrefill<T extends object>(
  base: T,
  prefill: Record<string, unknown> | undefined,
  translatable: TranslatableFields,
): T {
  if (!prefill) return base
  const fields = asSet(translatable)
  const from = base as Record<string, unknown>
  const merged: Record<string, unknown> = { ...from, ...prefill }
  for (const [field, value] of Object.entries(prefill)) {
    if (fields.has(field) && isPlainObject(value)) {
      merged[field] = mergeLocales(from[field], value)
    }
  }
  return merged as T
}

/**
 * What the assistant proposed, as the marks compare it: the prefill's own
 * values, except that a translatable it proposed text for is the merged pair
 * the form now holds. A mark is "the field still holds exactly what the
 * assistant proposed", and after a per-locale merge that is the whole pair,
 * not the one locale the prefill carried. A translatable with nothing in it
 * stays as sent, so it still proposes nothing and marks nothing.
 */
export function proposedFromPrefill(
  merged: object,
  prefill: Record<string, unknown> | undefined,
  translatable: TranslatableFields,
): Record<string, unknown> {
  if (!prefill) return {}
  const fields = asSet(translatable)
  const values = merged as Record<string, unknown>
  const out: Record<string, unknown> = { ...prefill }
  for (const [field, value] of Object.entries(prefill)) {
    if (fields.has(field) && isPlainObject(value) && proposesText(value)) {
      out[field] = values[field]
    }
  }
  return out
}
