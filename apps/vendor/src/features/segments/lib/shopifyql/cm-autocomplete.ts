/**
 * CodeMirror 6 autocompletion source — wraps the existing `analyzeContext`
 * engine so the CM6 popover and the previous custom popover share their
 * behaviour byte-for-byte (Phase 10B keeps Phase 8's intelligence layer).
 *
 * The CM6 completion API expects:
 *   - `from` / `to` text range to replace
 *   - `options` array (label / detail / apply)
 *
 * We translate `AutocompleteSuggestion` → CM6 `Completion` and let the
 * editor handle navigation / filtering / apply. CM6's built-in fuzzy
 * filter then trims the list down to what matches the typed prefix.
 */

import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete"
import {
  analyzeContext,
  type AutocompleteSuggestion,
} from "@/features/segments/lib/autocomplete"
import type { FilterCatalogEntry } from "@/features/segments/types"
import type { Translate } from "@/shared/i18n/translator"

/** Slot kinds with a heading in `segments.autocomplete.kinds`. */
const KNOWN_KINDS = new Set(["field", "operator", "value", "logic"])

const TYPE_FOR_KIND: Record<string, Completion["type"]> = {
  field: "variable",
  operator: "keyword",
  value: "enum",
  logic: "keyword",
}

/**
 * Build a CodeMirror completion source bound to the current filter catalog.
 * Returning a function (not a value) lets the editor re-read the catalog
 * each invocation, so loading the catalog asynchronously is fine.
 *
 * `getTranslate` returns the `segments.autocomplete` translator, read the same
 * way: the source outlives any one render, so it asks for the current one.
 */
export function makeShopifyqlCompletionSource(
  getCatalog: () => FilterCatalogEntry[],
  getTranslate: () => Translate,
) {
  return (context: CompletionContext): CompletionResult | null => {
    const text = context.state.doc.toString()
    const cursor = context.pos
    const catalog = getCatalog()

    const ctx = analyzeContext(text, cursor, catalog)
    if (!ctx.suggestions.length) return null

    // CM6 won't fire completions on whitespace unless explicit — but our
    // engine wants to suggest at any position (e.g. right after a space
    // following a keyword). We honour `explicit` and otherwise require a
    // non-empty prefix or boundary at a word/operator.
    if (!context.explicit && ctx.prefix === "") {
      const before = context.matchBefore(/[A-Za-z_=><!,()]+/)
      if (!before) return null
    }

    const t = getTranslate()
    return {
      from: ctx.tokenStart,
      to: ctx.tokenEnd,
      options: ctx.suggestions.map((s) =>
        suggestionToCompletion(s, ctx.kind, t),
      ),
      // We've already filtered by prefix in our analyzer — let CM6
      // re-filter to keep responsiveness when the user keeps typing.
      validFor: /^[A-Za-z_=><!]*$/,
    }
  }
}

function suggestionToCompletion(
  s: AutocompleteSuggestion,
  ctxKind: string,
  t: Translate,
): Completion {
  const description = s.descriptionKey ? t(s.descriptionKey) : s.description
  const kindHeading = KNOWN_KINDS.has(ctxKind) ? t(`kinds.${ctxKind}`) : ctxKind
  return {
    label: s.label,
    detail: description,
    type: TYPE_FOR_KIND[s.kind] ?? "text",
    info: () => {
      const div = document.createElement("div")
      div.className =
        "max-w-xs px-2 py-1 text-xs leading-tight text-muted-foreground"
      div.textContent = `${kindHeading}${description ? ` · ${description}` : ""}`
      return div
    },
    apply: (view, _completion, from, to) => {
      const insert = s.insert + (s.appendSpace ? " " : "")
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      })
    },
  }
}
