import type { StoreImportField } from "@/features/products/api"

/**
 * The review screen's bulk fill, as rules rather than component state.
 *
 * The fill writes one value — a stock count, a category — onto every product
 * in the screen's current view (`bulkFillStoreImportOverrides`). Which fields
 * it may write is the SERVER's decision (`StoreImportField.bulk_fillable`),
 * for the same reason the whole form is built from the server's field list:
 * a second copy here would offer a field the server then refuses.
 */

/** The fields a fill may write, in the order the server lists them. */
export function bulkFillableFields(
  fields: StoreImportField[],
): StoreImportField[] {
  return fields.filter((field) => field.bulk_fillable === true)
}

/**
 * The mutation's `fields`: only the values the merchant actually gave.
 *
 * A blank input means "leave this field alone", never "clear it" — the server
 * refuses an empty value, and a fill that could blank three hundred cells
 * because an input was left empty is the one mistake this dialog must not be
 * able to make. Null when nothing was given, so the confirm stays disabled.
 */
export function bulkFillValues(
  values: Record<string, string>,
  fields: StoreImportField[],
): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.key]?.trim()
    if (value) out[field.key] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Why the fill cannot be opened right now, or null when it can.
 *
 * `dirty` is the one worth explaining. The fill merges into what is SAVED on
 * the server, and the screen's draft is not saved yet — filling underneath it
 * and then saving the draft would put the two in an order the merchant never
 * chose. So the rule is plain: save or discard first. `loading` covers the
 * moment a new search is in flight, when the count on screen belongs to the
 * previous filter and the confirmation would name the wrong number.
 */
export function bulkFillBlocker({
  dirty,
  loading,
  total,
}: {
  dirty: boolean
  loading: boolean
  total: number
}): "dirty" | "loading" | "empty" | null {
  if (dirty) return "dirty"
  if (loading) return "loading"
  if (total <= 0) return "empty"
  return null
}
