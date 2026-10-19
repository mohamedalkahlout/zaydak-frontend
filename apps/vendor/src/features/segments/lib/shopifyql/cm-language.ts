/**
 * CodeMirror 6 language extension for ShopifyQL — Phase 10B.
 *
 * Uses `StreamLanguage` because the DSL is small enough that a
 * character-driven stream tokenizer is simpler than running Lezer.
 * Token tags map to the standard `@codemirror/language` highlight
 * vocabulary so the user's theme styles them consistently.
 *
 * NOTE: this tokenizer is *visual-only* — it mirrors the lexical
 * shape of ShopifyQL but does not validate. Real validation happens
 * via the linter extension (`./cm-linter.ts`), which runs the proper
 * `parseShopifyQL` and surfaces errors as squiggly underlines.
 */

import {
  LanguageSupport,
  StreamLanguage,
  StringStream,
} from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

const KEYWORDS = new Set([
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "BETWEEN",
  "CONTAINS",
  "MATCHES",
  "TRUE",
  "FALSE",
  "TODAY",
  "YESTERDAY",
  "FROM",
  "WHERE",
  "SHOW",
  "ORDER",
  "BY",
])

interface State {
  /* Reserved for future stateful highlighting (e.g. inside function args). */
  _: 0
}

function token(stream: StringStream, _state: State): string | null {
  if (stream.eatSpace()) return null

  // Single-quoted strings
  if (stream.match(/^'(?:[^']|'')*'?/)) return "string"

  // Date literal YYYY-MM-DD
  if (stream.match(/^\d{4}-\d{2}-\d{2}(?!\d)/)) return "literal"

  // Relative date offsets: -7d, +30d, -4w, +1y
  if (stream.match(/^[-+]\d+[dwmy](?![A-Za-z_])/i)) return "literal"

  // Numbers (incl. negatives that aren't a date-offset)
  if (stream.match(/^-?\d+(?:\.\d+)?/)) return "number"

  // Comparison operators
  if (stream.match(/^(?:!=|>=|<=|>|<|=)/)) return "operator"

  // Punctuation
  if (stream.match(/^[(),]/)) return "punctuation"

  // Identifier / keyword
  const ident = stream.match(/^[A-Za-z_][A-Za-z0-9_.]*/) as
    | RegExpMatchArray
    | null
  if (ident) {
    const word = ident[0]
    if (KEYWORDS.has(word.toUpperCase())) {
      if (word.toUpperCase() === "TRUE" || word.toUpperCase() === "FALSE") {
        return "bool"
      }
      return "keyword"
    }
    return "variableName"
  }

  // Unknown — skip one char so the stream advances.
  stream.next()
  return null
}

const shopifyqlStream = StreamLanguage.define<State>({
  name: "shopifyql",
  startState: () => ({ _: 0 }),
  token,
  tokenTable: {
    bool: t.bool,
    keyword: t.keyword,
    string: t.string,
    number: t.number,
    literal: t.literal,
    operator: t.operator,
    punctuation: t.punctuation,
    variableName: t.variableName,
  },
})

export function shopifyqlLanguage(): LanguageSupport {
  return new LanguageSupport(shopifyqlStream)
}
