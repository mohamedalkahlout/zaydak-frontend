"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { SUGGEST_PRODUCT_ATTRIBUTES } from "@/features/products/api"
import type {
  AttributeDefinition,
  AttributeSuggestion,
  AttributeSuggestionsResponse,
} from "@/features/products/types"
import type {
  AttributeValueEntryInput,
  ProductFormApi,
} from "@/features/products/validations/product"
import { isValueFilled, suggestionToEntry } from "@/features/products/lib/form/attribute-values"
import { isQuotaError } from "@/shared/lib/plan-errors"

/** What the banner needs to know about the last request. */
export type SuggestionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  /** Platform daily AI budget (or rate limit) — retrying will not help today. */
  | "quota"

export interface AttributeSuggestionsApi {
  status: SuggestionStatus
  /** Proposals still awaiting a decision, in the definitions' own order. */
  pending: AttributeSuggestion[]
  suggestionFor: (key: string) => AttributeSuggestion | undefined
  accept: (key: string) => void
  acceptAll: () => void
  dismiss: (key: string) => void
  dismissAll: () => void
  retry: () => void
}

/**
 * The "N suggestions available / Accept all" layer over the metafields card.
 *
 * ## Why it fires on its own
 *
 * A merchant who was going to fill fourteen metafields by hand would have
 * filled them by hand; the reason they are empty across the catalogue is that
 * nobody opens a chip called "Olfactory family". A button labelled "suggest"
 * inherits that same problem — it is one more thing not to click. So the ask
 * happens when the category is chosen, which is the moment the fields appear
 * and the only moment the merchant is thinking about them.
 *
 * ## What stops it from costing a fortune
 *
 * Nothing on the server does: the feature is free on every plan, so there is
 * no quota to run out of and only a per-user rate limit behind it. The
 * restraint is here. Exactly one request per category per mount, tracked in
 * `askedFor` — clicking through five categories asks five times, which is the
 * honest cost of changing your mind five times, while re-rendering, typing in
 * the title, opening a chip and accepting a value ask zero times. The request
 * is also skipped entirely when there is no product name to read or nothing
 * left to fill, so a merchant editing an already-complete product never fires
 * one at all.
 *
 * ## What it will not do
 *
 * **It never overwrites.** Keys that already have a value go out as
 * `skip_keys` and are never asked about, and `accept` re-checks the live form
 * value before writing — between the request and the click the merchant may
 * have answered the field themselves, and their answer wins.
 *
 * **It never saves.** Accepting writes to form state with `shouldDirty`, which
 * raises the contextual save bar and leaves the decision where the dashboard
 * puts every other edit: on the merchant's Save.
 */
export function useAttributeSuggestions({
  form,
  definitions,
  values,
  systemCategoryId,
  locale = "en",
  enabled = true,
}: {
  form: ProductFormApi
  definitions: AttributeDefinition[]
  values: Record<string, AttributeValueEntryInput> | undefined
  systemCategoryId: string | undefined
  locale?: string
  enabled?: boolean
}): AttributeSuggestionsApi {
  const [suggest, { loading }] = useMutation<AttributeSuggestionsResponse>(
    SUGGEST_PRODUCT_ATTRIBUTES,
  )

  /**
   * The last answer, and the category it was about.
   *
   * Cleared on a category change by the adjust-during-render block below rather
   * than by an effect, so the frame after switching category never paints the
   * previous one's suggestions.
   */
  const [result, setResult] = useState<{
    suggestions: AttributeSuggestion[]
    generated: boolean
    /** Set when the request failed; `quota` hides retry in the banner. */
    failure?: "quota" | "error"
  } | null>(null)
  const [decided, setDecided] = useState<Set<string>>(new Set())

  const [seededFor, setSeededFor] = useState(systemCategoryId)
  if (seededFor !== systemCategoryId) {
    setSeededFor(systemCategoryId)
    setResult(null)
    setDecided(new Set())
  }

  /**
   * Which category we have already spent a request on.
   *
   * A ref rather than state because nothing renders from it — writing it is
   * the point, and putting it in state would re-render the form on a value
   * only the effect reads.
   */
  const askedFor = useRef<string | null>(null)

  const emptyKeys = useMemo(
    () => definitions.filter((d) => !isValueFilled(d, values?.[d.key])).map((d) => d.key),
    [definitions, values],
  )
  const filledKeys = useMemo(
    () => definitions.map((d) => d.key).filter((k) => !emptyKeys.includes(k)),
    [definitions, emptyKeys],
  )

  /**
   * Ask about one category.
   *
   * The answer is written from Apollo's own completion callbacks rather than
   * from an `await` in here, which is the shape the React Compiler's
   * `set-state-in-effect` rule asks for and — more usefully — the shape that
   * makes the stale-response check natural: `requestedFor` is captured per
   * call, so a slow answer for the category the merchant just navigated away
   * from is dropped instead of painted over the new one's fields.
   */
  const request = useCallback(
    (requestedFor: string) => {
      const name = translatedName(form.getValues("name"))
      if (!name) return

      void suggest({
        variables: {
          input: {
            system_category_id: requestedFor,
            name,
            description: translatedName(form.getValues("description")) || undefined,
            brand: (form.getValues("brand") as string | undefined) || undefined,
            skip_keys: filledKeys,
          },
          locale,
        },
        // Non-fatal: the metafields card still works empty. Skip the Apollo
        // error-link console noise; the banner is the merchant-facing signal.
        context: { silentErrors: true },
        onCompleted: (data) => {
          if (askedFor.current !== requestedFor) return
          const payload = data?.suggestProductAttributes
          setResult({
            suggestions: payload?.data ?? [],
            generated: payload?.generated ?? false,
          })
        },
        onError: (err) => {
          // A failed suggestion is not a failed product form. Quota/budget
          // refusals hide retry (waiting is the only fix); other failures
          // keep the retry affordance.
          if (askedFor.current !== requestedFor) return
          setResult({
            suggestions: [],
            generated: false,
            failure: isQuotaError(err) ? "quota" : "error",
          })
        },
      })
    },
    [form, suggest, filledKeys, locale],
  )

  // Fire once per category. The effect itself sets no state — the answer
  // arrives through Apollo's callbacks above, which is the "subscribe to an
  // external system" half of the rule rather than the cascading-render half.
  useEffect(() => {
    if (!enabled || !systemCategoryId) return
    if (askedFor.current === systemCategoryId) return
    // Nothing to fill is not worth a model call, and neither is a product with
    // no title for the model to read.
    if (emptyKeys.length === 0) return
    if (!translatedName(form.getValues("name"))) return

    askedFor.current = systemCategoryId
    request(systemCategoryId)
  }, [enabled, systemCategoryId, emptyKeys.length, form, request])

  const byKey = useMemo(() => {
    const map = new Map<string, AttributeSuggestion>()
    for (const s of result?.suggestions ?? []) map.set(s.key, s)
    return map
  }, [result])

  /**
   * A suggestion survives to the banner only while it is still unanswered.
   *
   * The `isValueFilled` check is what makes a race harmless: the merchant may
   * have typed the answer themselves while the request was in flight, and a
   * proposal for a field that now has a value would be an invitation to
   * overwrite it.
   */
  const pending = useMemo(
    () =>
      definitions
        .filter((d) => !decided.has(d.key) && !isValueFilled(d, values?.[d.key]))
        .map((d) => byKey.get(d.key))
        .filter((s): s is AttributeSuggestion => !!s),
    [definitions, decided, values, byKey],
  )

  const markDecided = useCallback((keys: string[]) => {
    setDecided((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.add(key)
      return next
    })
  }, [])

  const write = useCallback(
    (suggestions: AttributeSuggestion[]) => {
      const current =
        (form.getValues("attribute_values") as
          | Record<string, AttributeValueEntryInput>
          | undefined) ?? {}
      const next = { ...current }
      let changed = false

      for (const suggestion of suggestions) {
        const def = definitions.find((d) => d.key === suggestion.key)
        // Re-checked here and not only in `pending`: "Accept all" acts on a
        // list built one render ago.
        if (!def || isValueFilled(def, next[suggestion.key])) continue
        const entry = suggestionToEntry(suggestion)
        if (!entry) continue
        next[suggestion.key] = entry
        changed = true
      }

      if (changed) {
        // `shouldDirty` is the whole handover: it raises the unsaved bar, and
        // the merchant's Save is what turns a suggestion into catalogue data.
        form.setValue("attribute_values", next, { shouldDirty: true })
      }
      markDecided(suggestions.map((s) => s.key))
    },
    [form, definitions, markDecided],
  )

  const accept = useCallback(
    (key: string) => {
      const suggestion = byKey.get(key)
      if (suggestion) write([suggestion])
    },
    [byKey, write],
  )

  const acceptAll = useCallback(() => write(pending), [write, pending])

  const dismiss = useCallback((key: string) => markDecided([key]), [markDecided])

  const dismissAll = useCallback(
    () => markDecided(pending.map((s) => s.key)),
    [markDecided, pending],
  )

  const retry = useCallback(() => {
    if (!systemCategoryId) return
    setResult(null)
    setDecided(new Set())
    // `askedFor` already names this category, so the completion check passes
    // and the once-per-category guard stays honest: a retry is the merchant
    // asking again, not the effect firing twice.
    request(systemCategoryId)
  }, [request, systemCategoryId])

  const status: SuggestionStatus = loading
    ? "loading"
    : !result
      ? "idle"
      : result.failure === "quota"
        ? "quota"
        : result.generated
          ? "ready"
          : "unavailable"

  return {
    status,
    pending,
    suggestionFor: (key: string) => byKey.get(key),
    accept,
    acceptAll,
    dismiss,
    dismissAll,
    retry,
  }
}

/**
 * The product title as one string, whichever language it was typed in.
 *
 * The form holds a `{ en, ar }` pair and a merchant fills one side of it; the
 * model reads whichever is there rather than being handed an empty `en`.
 */
function translatedName(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["en", "ar"]) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
    }
  }
  return ""
}
