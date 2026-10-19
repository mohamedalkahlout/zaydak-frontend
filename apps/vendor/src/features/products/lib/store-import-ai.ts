import {
  getErrorCode,
  getValidationErrors,
} from "@/shared/lib/auth/graphql-errors"
import type { AiAction, AiTarget } from "@/shared/lib/ai-text"
import type { StoreImportField } from "@/features/products/api"

/**
 * The review screen's AI assist, as pure functions.
 *
 * Which fields offer it, what they offer, what shape of answer they ask for,
 * and how a model's answer is reduced to something a CSV cell can hold. No
 * React and no Apollo, so every rule here is testable without rendering —
 * which matters more than usual, because the rules are about not destroying a
 * merchant's own words.
 */

/**
 * Fields a model can usefully help with, and what it may do to each.
 *
 * Deliberately **not** every editable field. Price, sale price, cost, stock,
 * SKU and barcode are absent because there is no sense in which a model can
 * improve a number a merchant's old store recorded — inventing one is the
 * failure mode, and offering the button is the invitation. The category is
 * absent from this list too: it is not text, and it has its own suggestion
 * path that resolves against the real taxonomy.
 *
 * The translation rows carry ONE action, which is why the row renders a single
 * press rather than a menu: "translate" is the only thing to do to an empty
 * Arabic cell whose English neighbour is right there.
 */
export const AI_FIELD_ACTIONS: Record<string, readonly AiAction[]> = {
  name_en: ["improve", "shorten", "simplify"],
  description_en: ["improve", "shorten", "extend", "simplify"],
  brand: ["improve"],
  name_ar: ["translate-ar"],
  description_ar: ["translate-ar"],
}

/** What this field offers, or nothing at all. */
export function aiActionsFor(field: StoreImportField): readonly AiAction[] {
  return AI_FIELD_ACTIONS[field.key] ?? []
}

/**
 * Which plan key an action spends — the same map `AiEditorService.capabilityFor`
 * uses. The review screen reads `myEntitlements` against this so a shop whose
 * plan excludes rewrite finds out from a disabled item, not from the error.
 */
export function aiCapabilityFor(action: AiAction): string {
  switch (action) {
    case "shorten":
      return "ai.text.summarize"
    case "translate-en":
    case "translate-ar":
      return "ai.text.translate"
    case "custom":
      return "ai.text.generate"
    default:
      return "ai.text.rewrite"
  }
}

/**
 * Why this action is not available, as a message key under
 * `products.import.review`. Null while entitlements are still loading, so the
 * control does not flash disabled on first paint.
 */
export function aiPlanDeniedKey(state: {
  allowed: boolean
  exhausted: boolean
  loading?: boolean
}): string | null {
  if (state.loading) return null
  if (!state.allowed) return "aiNotInPlan"
  if (state.exhausted) return "aiQuota"
  return null
}

/**
 * A field whose answer is one line rather than a document.
 *
 * Derived from the field's own `kind` rather than listed by key, so a text
 * column added to the catalogue tomorrow is classified correctly without
 * anybody remembering this file. `multiline` is the only kind that holds a
 * document; the CSV's description columns carry the source store's HTML.
 */
export function aiTargetFor(field: StoreImportField): AiTarget {
  return field.kind === "multiline" ? "RICH_TEXT" : "PLAIN_LINE"
}

/**
 * A model's answer, as a value this cell can actually hold.
 *
 * `PLAIN_LINE` answers are reduced server-side too, and this is not a
 * duplicate of that: the server states the contract, and the client defends
 * it. A regex is not a parser, the answer crosses a network, and the cell it
 * lands in has a hard `max_length` the server's own validator will refuse a
 * save for. Better to clamp before staging than to let a merchant press Save
 * and be told their AI suggestion is too long.
 *
 * A `RICH_TEXT` answer is passed through: the column holds the source store's
 * HTML already, and the importer writes it as it finds it.
 */
export function aiAnswerForField(
  field: StoreImportField,
  answer: string,
): string {
  if (aiTargetFor(field) === "RICH_TEXT") return answer.trim()
  const line = plainLine(answer)
  return field.max_length ? clampWords(line, field.max_length) : line
}

/**
 * HTML, entities and a model's helpful packaging, reduced to one line.
 *
 * Block boundaries become spaces rather than vanishing, so `<p>a</p><p>b</p>`
 * reads "a b" and not "ab" — a product name, not a different product name.
 */
export function plainLine(raw: string): string {
  return raw
    .replace(/```(?:\w+)?/g, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\*+|\*+$/g, "")
    .replace(/^(?:title|name|answer|result|output)\s*[:\-—]\s*/i, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim()
}

/** Cut on a word where there is one worth honouring; half a word never helps. */
export function clampWords(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

/**
 * What a model is given to work from.
 *
 * Always the text that will actually be IMPORTED — the merchant's own edit
 * where they made one, the scan's value otherwise — and for a translation row
 * that is the English neighbour rather than the empty Arabic cell. Handing the
 * model the raw scan after a merchant had corrected it would improve a title
 * nobody is going to ship.
 */
export function aiSourceFor(args: {
  /**
   * What this cell will import: staged, then saved, then scanned — and
   * nothing for a cell the merchant cleared (`importedDisplay`).
   */
  own: string
  /** What the reference column shows — the English, on a translation row. */
  reference: string
  field: StoreImportField
}): string {
  return args.field.reference_key ? args.reference : args.own
}

/**
 * Error codes an AI refusal can carry, and the message key that explains it.
 *
 * Its own map rather than `storeImportErrorKey`'s, because these are a
 * different set of problems with different advice: nothing here is about the
 * scan, and "your plan does not include this" is a sentence about a feature
 * rather than about an import. The two would have to be told apart inside one
 * map anyway, since `FEATURE_NOT_AVAILABLE` means something different on each.
 *
 * Two places to look, for the reason `storeImportErrorKey` documents: a refusal
 * carries its code in `extensions.error_code`, while an exhausted allowance is
 * a validation error whose real code sits in `validation_errors[0].code`.
 */
export const AI_ERROR_KEYS: Record<string, string> = {
  FEATURE_NOT_AVAILABLE: "aiNotInPlan",
  PLAN_QUOTA_EXCEEDED: "aiQuota",
  PLAN_LIMIT_REACHED: "aiQuota",
  // The per-user hourly/daily limiter and the platform's daily budget both
  // arrive as validation errors; a merchant can act on neither except by
  // waiting, so they share one sentence.
  AI_RATE_LIMITED: "aiRateLimited",
  RATE_LIMIT_EXCEEDED: "aiRateLimited",
}

export function aiErrorKey(err: unknown): string {
  const code = getErrorCode(err)
  if (code && AI_ERROR_KEYS[code]) return AI_ERROR_KEYS[code]
  const validation = getValidationErrors(err)[0]?.code
  if (validation && AI_ERROR_KEYS[validation]) return AI_ERROR_KEYS[validation]
  return "aiFailed"
}
