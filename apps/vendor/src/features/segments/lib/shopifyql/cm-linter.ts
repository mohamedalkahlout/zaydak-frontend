/**
 * CodeMirror 6 linter for ShopifyQL — surfaces `ParserError` /
 * `LexerError` from our real engine as inline diagnostics.
 *
 *   WHERE amount_spent > BETWEN 10 AND 20
 *                        ^^^^^^^^ Expected operator
 *
 * The linter re-runs whenever the document changes (CM6 debounces it for
 * us). It's the *source of truth* for validity — the syntax highlighter
 * in `cm-language.ts` is only visual.
 */

import { linter, type Diagnostic } from "@codemirror/lint"
import type { EditorView } from "@codemirror/view"
import {
  LexerError,
  ParserError,
  parseShopifyQL,
} from "@/features/segments/lib/shopifyql"
import type { Translate } from "@/shared/i18n/translator"

/**
 * `getTranslate` returns the `segments.diagnostics` translator — a getter,
 * because the linter outlives any one render of the editor.
 */
export function shopifyqlLinter(getTranslate: () => Translate) {
  return linter((view: EditorView): Diagnostic[] => {
    const text = view.state.doc.toString().trim()
    if (!text) return []
    try {
      parseShopifyQL(text)
      return []
    } catch (err) {
      const t = getTranslate()
      if (err instanceof ParserError || err instanceof LexerError) {
        // Both error types carry 1-indexed `column`. We map to 0-indexed
        // document offsets and underline the rest of the token.
        const from = clamp(err.column - 1, 0, view.state.doc.length)
        const to = nextWordBoundary(view.state.doc.toString(), from)
        return [
          {
            from,
            to,
            severity: "error",
            message: describeEngineError(err, t),
          },
        ]
      }
      return [
        {
          from: 0,
          to: view.state.doc.length,
          severity: "error",
          message: err instanceof Error ? err.message : t("unknown"),
        },
      ]
    }
  })
}

/**
 * The engine's messages are English, and `parser.ts` / `lexer.ts` are kept
 * byte-for-byte identical to the back-end copy, so they carry no message keys.
 * The merchant's wording is picked here instead: each detail the engine can
 * produce maps to a key under `segments.diagnostics`, with the quoted token
 * carried over. A detail this table does not recognise is shown as the engine
 * wrote it, so a new engine message degrades to English rather than to a key.
 */
const DETAILS: ReadonlyArray<{
  pattern: RegExp
  key: string
  params?: readonly string[]
}> = [
  { pattern: /^extra input after expression$/, key: "parser.extraInput" },
  { pattern: /^expected \) closing group$/, key: "parser.unclosedGroup" },
  {
    pattern: /^expected field name, got '(.*)'$/,
    key: "parser.expectedField",
    params: ["got"],
  },
  { pattern: /^expected NULL after IS$/, key: "parser.expectedNullAfterIs" },
  { pattern: /^expected AND in BETWEEN$/, key: "parser.expectedAndInBetween" },
  {
    pattern: /^unexpected token after NOT: '(.*)'$/,
    key: "parser.unexpectedAfterNot",
    params: ["got"],
  },
  {
    pattern: /^expected operator, got '(.*)'$/,
    key: "parser.expectedOperator",
    params: ["got"],
  },
  {
    pattern: /^expected value, got '(.*)'$/,
    key: "parser.expectedValue",
    params: ["got"],
  },
  {
    pattern: /^expected \) closing value group$/,
    key: "parser.unclosedValueGroup",
  },
  {
    pattern: /^expected \( starting IN list$/,
    key: "parser.expectedInListOpen",
  },
  { pattern: /^expected \) closing IN list$/, key: "parser.unclosedInList" },
  {
    pattern: /^expected \( starting MATCHES args$/,
    key: "parser.expectedMatchesOpen",
  },
  {
    pattern: /^expected \) closing MATCHES args$/,
    key: "parser.unclosedMatches",
  },
  {
    pattern: /^expected argument name \(e\.g\. count, date, id\)$/,
    key: "parser.expectedArgName",
  },
  {
    pattern: /^invalid date offset '(.*)'$/,
    key: "parser.invalidDateOffset",
    params: ["got"],
  },
  {
    pattern: /^expected (\S+), got (\S+) \('(.*)'\)$/,
    key: "parser.expectedToken",
    params: ["expected", "got", "text"],
  },
  { pattern: /^expected '=' after '!'$/, key: "lexer.expectedEqAfterBang" },
  {
    pattern: /^unexpected character '(.*)'$/,
    key: "lexer.unexpectedChar",
    params: ["got"],
  },
  { pattern: /^unterminated string literal$/, key: "lexer.unterminatedString" },
  {
    pattern: /^invalid number '(.*)'$/,
    key: "lexer.invalidNumber",
    params: ["got"],
  },
]

/** The engine prefixes every detail with where it happened. */
const LOCATION_PREFIX = /^(?:Parser|Lexer) error at column \d+: /

/** Exported for its test — the linter is the only caller. */
export function describeEngineError(
  err: ParserError | LexerError,
  t: Translate,
): string {
  const detail = err.message.replace(LOCATION_PREFIX, "")
  for (const { pattern, key, params = [] } of DETAILS) {
    const match = pattern.exec(detail)
    if (!match) continue
    const values = Object.fromEntries(
      params.map((name, i) => [name, match[i + 1] ?? ""]),
    )
    return t(err instanceof LexerError ? "lexerAt" : "parserAt", {
      column: err.column,
      detail: t(key, values),
    })
  }
  return err.message
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

function nextWordBoundary(text: string, from: number): number {
  // Advance to the next whitespace / paren / comma so the underline is
  // visible at meaningful width. Single-char minimum so empty regions
  // still get a marker.
  let i = from
  while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) i++
  return Math.max(i, from + 1)
}
