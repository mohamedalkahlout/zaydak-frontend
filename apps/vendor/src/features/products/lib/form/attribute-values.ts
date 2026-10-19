import type { AttributeDefinition, AttributeSuggestion } from "@/features/products/types"
import type { AttributeValueEntryInput } from "@/features/products/validations/product"

/**
 * Whether a metafield has an answer in it.
 *
 * Drives three things at once, which is why it lives here rather than inside
 * the card: whether a definition renders as an opened row or a collapsed chip,
 * whether the row's Clear affordance is offered, and — since suggestions only
 * ever fill a blank — whether the field is even asked about.
 */
export function isValueFilled(
  def: AttributeDefinition,
  entry: AttributeValueEntryInput | undefined,
): boolean {
  if (!entry) return false
  switch (def.type) {
    case "TEXT":
      return typeof entry.text === "string" && entry.text.trim() !== ""
    case "NUMBER":
      return typeof entry.number === "number" && !Number.isNaN(entry.number)
    case "BOOLEAN":
      // A user-set `false` should count as filled so the row stays open.
      return typeof entry.boolean === "boolean"
    case "SELECT":
      return typeof entry.option === "string" && entry.option !== ""
    case "MULTI_SELECT":
      return Array.isArray(entry.options) && entry.options.length > 0
    default:
      return false
  }
}

/**
 * A server suggestion as the form stores it.
 *
 * The two shapes are deliberately parallel — the back-end returns option
 * **value slugs** rather than ids for exactly this reason — so accepting is a
 * copy into `attribute_values` and never a lookup that could fail halfway.
 * Returns null for a suggestion carrying nothing usable, which the server
 * should never send but which would otherwise open a row on an empty value.
 */
export function suggestionToEntry(
  suggestion: AttributeSuggestion,
): AttributeValueEntryInput | null {
  switch (suggestion.type) {
    case "TEXT":
      return suggestion.value_text ? { text: suggestion.value_text } : null
    case "NUMBER":
      return typeof suggestion.value_number === "number"
        ? { number: suggestion.value_number }
        : null
    case "BOOLEAN":
      return typeof suggestion.value_boolean === "boolean"
        ? { boolean: suggestion.value_boolean }
        : null
    case "SELECT":
      return suggestion.value_option ? { option: suggestion.value_option } : null
    case "MULTI_SELECT":
      return suggestion.value_options?.length
        ? { options: suggestion.value_options }
        : null
    default:
      return null
  }
}

/**
 * The label a merchant should see for a proposed value.
 *
 * SELECT and MULTI_SELECT arrive as slugs, which are what the wire needs and
 * not what anybody wants to read in a banner — `roll_on` where the option is
 * called "Roll-on". Falls back to the slug when the definition no longer has
 * the option, which can only happen if an admin edits the schema mid-form.
 *
 * A BOOLEAN reads through `booleanLabel`, the caller's already-localized
 * yes/no — this module has no translator of its own to say it with.
 */
export function suggestionPreview(
  def: AttributeDefinition,
  suggestion: AttributeSuggestion,
  translate: (label: AttributeDefinition["name"]) => string,
  booleanLabel: (value: boolean) => string,
): string {
  const labelOf = (slug: string) => {
    const option = def.options.find((o) => o.value === slug)
    return option ? translate(option.label) || slug : slug
  }

  switch (suggestion.type) {
    case "TEXT":
      return suggestion.value_text ?? ""
    case "NUMBER":
      return suggestion.value_number == null
        ? ""
        : `${suggestion.value_number}${def.unit ? ` ${def.unit}` : ""}`
    case "BOOLEAN":
      return booleanLabel(!!suggestion.value_boolean)
    case "SELECT":
      return suggestion.value_option ? labelOf(suggestion.value_option) : ""
    case "MULTI_SELECT":
      return (suggestion.value_options ?? []).map(labelOf).join(", ")
    default:
      return ""
  }
}

// ── Scrolling to the metafields, from elsewhere on the form ─────────

/** Stable DOM id for the Category metafields card. */
export const CATEGORY_METAFIELDS_DOM_ID = "category-metafields"

/**
 * Stable DOM id for one metafield row.
 *
 * Shared rather than redeclared: three places on this form navigate to a
 * metafield — the category picker's count badge, the variant row's connected
 * badge, and the card itself, which is what renders the target. Two copies of
 * this string had already appeared before the third arrived, and the failure
 * mode of a drifted copy is a scroll that silently does nothing.
 */
export function metafieldRowDomId(key: string): string {
  return `metafield-${key}`
}

/**
 * Bring the metafields into view — a row when named, otherwise the card.
 *
 * `block: "center"` rather than `"start"`: the card can sit under the sticky
 * save bar, and a section scrolled to exactly the top of the viewport is a
 * section half-covered by it.
 */
export function scrollToMetafields(key?: string): void {
  if (typeof document === "undefined") return
  const el = document.getElementById(
    key ? metafieldRowDomId(key) : CATEGORY_METAFIELDS_DOM_ID,
  )
  el?.scrollIntoView({ block: "center", behavior: "smooth" })
}
