/**
 * Context-aware autocomplete for the ShopifyQL editor.
 *
 * Two-pass design:
 *   1. Tokenise the entire source (tolerant — incomplete tokens are OK).
 *   2. Find the token that the cursor *touches* (inside, or the boundary
 *      between two tokens) and decide what slot it occupies based on the
 *      surrounding tokens. That slot drives the suggestion list.
 *
 * Slots:
 *   - `field`     → field names from the filter catalogue
 *   - `operator`  → that field's allowed operators (with human labels)
 *   - `value`     → enum values for the field, or function-arg keys when
 *                   inside a `MATCHES (...)` call
 *   - `logic`     → AND / OR connectors between conditions
 *
 * The returned context exposes `tokenStart` + `tokenEnd` so the editor
 * can replace the current token wholesale — which makes click-to-replace
 * "natural" (mirroring Shopify: click on `MATCHES`, pick `NOT MATCHES`).
 */

import type { FilterCatalogEntry } from "@/features/segments/types"

export type AutocompleteKind = "field" | "operator" | "value" | "logic"

export interface AutocompleteSuggestion {
  /** Primary label shown in the popover row. */
  label: string
  /**
   * Short human description shown under the label — the filter catalogue's
   * own text, for a field.
   */
  description?: string
  /**
   * Message key under `segments.autocomplete` for a description this module
   * owns (operators, AND / OR). Translated where the suggestion is rendered;
   * the label beside it is ShopifyQL syntax and stays as typed.
   */
  descriptionKey?: string
  /** The exact text inserted when the suggestion is accepted. */
  insert: string
  /** Whether the editor should append a trailing space (so the next slot can autocomplete). */
  appendSpace?: boolean
  /** Token-kind tag the UI can use to colour-code rows. */
  kind: AutocompleteKind
}

export interface AutocompleteContext {
  kind: AutocompleteKind
  fieldName?: string
  operator?: string
  /** Already-typed prefix of the current token (used to filter suggestions). */
  prefix: string
  /** Where the current token starts (inclusive). */
  tokenStart: number
  /** Where the current token ends (exclusive). */
  tokenEnd: number
  /** Whether the editor should wrap the inserted string value in quotes. */
  needsQuoting: boolean
  suggestions: AutocompleteSuggestion[]
}

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
])

/**
 * Every operator the editor knows, mapped to its description's message key
 * (`segments.autocomplete.operators.<key>`). Insertion order is the fallback
 * operator list for a field the catalogue does not describe.
 */
const OPERATOR_KEYS: Record<string, string> = {
  "=": "eq",
  "!=": "neq",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
  IN: "in",
  "NOT IN": "notIn",
  CONTAINS: "contains",
  "NOT CONTAINS": "notContains",
  "IS NULL": "isNull",
  "IS NOT NULL": "isNotNull",
  BETWEEN: "between",
  MATCHES: "matches",
  "NOT MATCHES": "notMatches",
}

const TERMINAL_OPERATORS = new Set(["IS NULL", "IS NOT NULL"])

// ─── Tokenizer (tolerant) ───────────────────────────────────────────────

interface Tok {
  type:
    | "ident"
    | "keyword"
    | "string"
    | "number"
    | "date"
    | "date_offset"
    | "op"
    | "lparen"
    | "rparen"
    | "comma"
    | "whitespace"
  value: string
  /** Source offset of the first character. */
  start: number
  /** Source offset *after* the last character. */
  end: number
}

const TOKEN_RE =
  /'(?:[^']|'')*'?|\d{4}-\d{2}-\d{2}|[-+]\d+[dwmy]|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.]*|!=|>=|<=|[=<>(),]|\s+/g

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  let match: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const value = match[0]
    const start = match.index
    const end = start + value.length
    out.push({ type: classify(value), value, start, end })
  }
  return out
}

function classify(value: string): Tok["type"] {
  if (/^\s+$/.test(value)) return "whitespace"
  if (value.startsWith("'")) return "string"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date"
  if (/^[-+]\d+[dwmy]$/.test(value)) return "date_offset"
  if (/^\d/.test(value)) return "number"
  if (value === "(") return "lparen"
  if (value === ")") return "rparen"
  if (value === ",") return "comma"
  if (/^[=<>!]/.test(value)) return "op"
  if (KEYWORDS.has(value.toUpperCase())) return "keyword"
  return "ident"
}

// ─── Cursor → "current token" resolution ────────────────────────────────

interface CurrentToken {
  /** Existing token under cursor (or null when in whitespace / EOF). */
  tok: Tok | null
  /** Index of `tok` in the source token list (or -1 when null). */
  index: number
  prefix: string
  start: number
  end: number
  /** Whether the cursor is inside a quoted string literal. */
  inString: boolean
}

function findCurrentToken(tokens: Tok[], cursor: number): CurrentToken {
  // Find the token containing cursor (cursor is *between* characters).
  let foundIdx = -1
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    // Cursor is strictly inside (cursor > start && cursor < end)
    // or touching the right edge of an ident/keyword/string (so partial typing works).
    if (cursor > t.start && cursor <= t.end) {
      foundIdx = i
      break
    }
  }
  if (foundIdx < 0) {
    return {
      tok: null,
      index: -1,
      prefix: "",
      start: cursor,
      end: cursor,
      inString: false,
    }
  }
  const tok = tokens[foundIdx]
  if (tok.type === "whitespace") {
    return {
      tok: null,
      index: -1,
      prefix: "",
      start: cursor,
      end: cursor,
      inString: false,
    }
  }
  if (
    tok.type === "ident" ||
    tok.type === "keyword" ||
    tok.type === "number" ||
    tok.type === "date" ||
    tok.type === "date_offset" ||
    tok.type === "op"
  ) {
    return {
      tok,
      index: foundIdx,
      prefix: tok.value.slice(0, cursor - tok.start),
      start: tok.start,
      end: tok.end,
      inString: false,
    }
  }
  if (tok.type === "string") {
    // Strip leading/trailing quotes for the prefix.
    const inner = tok.value.replace(/^'/, "").replace(/'$/, "")
    const relCursor = cursor - tok.start - 1 // skip opening quote
    const innerPrefix = relCursor > 0 ? inner.slice(0, relCursor) : ""
    return {
      tok,
      index: foundIdx,
      prefix: innerPrefix,
      start: tok.start,
      end: tok.end,
      inString: true,
    }
  }
  return {
    tok,
    index: foundIdx,
    prefix: "",
    start: tok.start,
    end: tok.end,
    inString: false,
  }
}

// ─── Look-back helpers ───────────────────────────────────────────────────

/**
 * Walk the token list backwards from `fromIdx` (exclusive), skipping
 * whitespace + balanced parens, and return the *meaningful* token list
 * in source order. Stops at `AND`/`OR`/start-of-input.
 */
function tokensInCurrentCondition(
  tokens: Tok[],
  fromIdx: number,
): Tok[] {
  const out: Tok[] = []
  let depth = 0
  for (let i = fromIdx - 1; i >= 0; i--) {
    const t = tokens[i]
    if (t.type === "whitespace") continue
    if (t.type === "rparen") {
      depth++
      continue
    }
    if (t.type === "lparen") {
      if (depth === 0) {
        // Cursor is inside an open paren — include the lparen in the trace
        // so the caller knows it's nested.
        out.unshift(t)
        return out
      }
      depth--
      continue
    }
    if (depth > 0) continue
    if (
      t.type === "keyword" &&
      (t.value.toUpperCase() === "AND" || t.value.toUpperCase() === "OR")
    ) {
      // Boundary between conditions.
      return out
    }
    out.unshift(t)
  }
  return out
}

function isKeyword(tok: Tok | undefined, ...names: string[]): boolean {
  if (!tok) return false
  if (tok.type !== "keyword") return false
  return names.length === 0 || names.includes(tok.value.toUpperCase())
}

/**
 * Recognise a multi-word operator starting at the head of `tokens`.
 * Returns the operator + how many tokens it consumed.
 */
function detectOperator(
  tokens: Tok[],
): { operator: string; consumed: number } | null {
  const [a, b, c] = tokens
  if (isKeyword(a, "IS") && isKeyword(b, "NOT") && isKeyword(c, "NULL"))
    return { operator: "IS NOT NULL", consumed: 3 }
  if (isKeyword(a, "IS") && isKeyword(b, "NULL"))
    return { operator: "IS NULL", consumed: 2 }
  if (isKeyword(a, "NOT") && isKeyword(b, "IN"))
    return { operator: "NOT IN", consumed: 2 }
  if (isKeyword(a, "NOT") && isKeyword(b, "CONTAINS"))
    return { operator: "NOT CONTAINS", consumed: 2 }
  if (isKeyword(a, "NOT") && isKeyword(b, "MATCHES"))
    return { operator: "NOT MATCHES", consumed: 2 }
  if (a?.type === "op")
    return { operator: a.value, consumed: 1 }
  if (isKeyword(a, "IN", "CONTAINS", "MATCHES", "BETWEEN"))
    return { operator: a.value.toUpperCase(), consumed: 1 }
  return null
}

// ─── Public API ─────────────────────────────────────────────────────────

export function analyzeContext(
  text: string,
  cursor: number,
  catalog: FilterCatalogEntry[],
): AutocompleteContext {
  const tokens = tokenize(text)
  const cur = findCurrentToken(tokens, cursor)

  // If we're inside a partially-typed token, work with what comes *before*
  // it as context. Otherwise, look at the preceding tokens up to cursor.
  const ctxIdx = cur.index >= 0 ? cur.index : tokensBeforeCursorIdx(tokens, cursor)
  const condition = tokensInCurrentCondition(tokens, ctxIdx + 1)

  // Drop the current token if it's at the tail — we re-derive context
  // from the settled tokens *before* it. Exception: lparen stays in
  // `settled` because we want `contextInsideParen` to fire when the
  // cursor is right after `(` (so `IN (`, `MATCHES (`, etc. resolve to
  // value / function-arg slots instead of field slots).
  const settled =
    cur.index >= 0 &&
    condition.length &&
    condition[condition.length - 1] === cur.tok &&
    cur.tok!.type !== "lparen"
      ? condition.slice(0, -1)
      : condition

  // Special case: cursor is past a balanced `(...)` group → next slot is
  // a logical connective (AND/OR). The condition walk drops the whole
  // closed group on the floor (it doesn't count as "the current
  // condition"), leaving `settled` empty — but field context is wrong
  // here. We peek backwards through whitespace and check for a trailing
  // `)` to recover the right answer.
  if (settled.length === 0 && cur.index < 0) {
    const prior = lastNonWhitespaceTokenBefore(tokens, cursor)
    if (prior?.type === "rparen") {
      return makeLogicContext(cur.prefix, cur.start, cur.end)
    }
  }

  return decide({
    text,
    cursor,
    settled,
    cur,
    catalog,
  })
}

function lastNonWhitespaceTokenBefore(
  tokens: Tok[],
  cursor: number,
): Tok | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    if (t.end > cursor) continue
    if (t.type === "whitespace") continue
    return t
  }
  return null
}

function tokensBeforeCursorIdx(tokens: Tok[], cursor: number): number {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].end <= cursor) return i
  }
  return -1
}

interface DecideArgs {
  text: string
  cursor: number
  settled: Tok[]
  cur: CurrentToken
  catalog: FilterCatalogEntry[]
}

function decide(a: DecideArgs): AutocompleteContext {
  const { settled, cur, catalog } = a
  const tokenStart = cur.tok ? cur.start : cur.start
  const tokenEnd = cur.tok ? cur.end : cur.end
  const prefix = cur.prefix
  const inString = cur.inString

  // Empty condition trace → field position (start of new condition).
  if (settled.length === 0) {
    return makeFieldContext(prefix, tokenStart, tokenEnd, catalog)
  }

  // First token is a `(` → we're nested inside it; inspect the wrapper.
  if (settled[0].type === "lparen") {
    return contextInsideParen(settled, prefix, tokenStart, tokenEnd, inString, catalog, a)
  }

  // Field [+ operator [+ values...]] sequence.
  const first = settled[0]
  if (first.type === "ident") {
    const fieldName = first.value
    const opChain = detectOperator(settled.slice(1))
    if (!opChain) {
      // Field typed, no operator yet → operator slot.
      return makeOperatorContext(fieldName, prefix, tokenStart, tokenEnd, catalog)
    }
    const operator = opChain.operator
    const afterOp = settled.slice(1 + opChain.consumed)
    if (TERMINAL_OPERATORS.has(operator)) {
      // IS NULL / IS NOT NULL — only AND / OR makes sense next.
      return makeLogicContext(prefix, tokenStart, tokenEnd)
    }
    if (!afterOp.length) {
      // Right after operator → value slot.
      return makeValueContext(fieldName, operator, prefix, tokenStart, tokenEnd, inString, catalog)
    }
    // Tokens after operator → either still typing value, or done.
    const last = afterOp[afterOp.length - 1]
    if (
      last.type === "string" ||
      last.type === "number" ||
      last.type === "date" ||
      last.type === "date_offset" ||
      isKeyword(last, "TODAY", "YESTERDAY", "TRUE", "FALSE", "NULL")
    ) {
      return makeLogicContext(prefix, tokenStart, tokenEnd)
    }
    if (isKeyword(last, "BETWEEN", "AND") || last.type === "comma") {
      return makeValueContext(fieldName, operator, prefix, tokenStart, tokenEnd, inString, catalog)
    }
    return makeValueContext(fieldName, operator, prefix, tokenStart, tokenEnd, inString, catalog)
  }

  // Fallback: assume a fresh field-name slot.
  return makeFieldContext(prefix, tokenStart, tokenEnd, catalog)
}

function contextInsideParen(
  settled: Tok[],
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
  inString: boolean,
  catalog: FilterCatalogEntry[],
  args: DecideArgs,
): AutocompleteContext {
  // What was just before the `(` in the outer scope? Walk tokens above
  // the paren in the original token list.
  const lparen = settled[0]
  const allTokens = tokenize(args.text)
  const lparenIdx = allTokens.findIndex(
    (t) => t.start === lparen.start && t.end === lparen.end,
  )
  if (lparenIdx <= 0) {
    return makeFieldContext(prefix, tokenStart, tokenEnd, catalog)
  }
  // Find the meaningful tokens immediately before `(`.
  const beforeParen: Tok[] = []
  let depth = 0
  for (let i = lparenIdx - 1; i >= 0; i--) {
    const t = allTokens[i]
    if (t.type === "whitespace") continue
    if (t.type === "rparen") {
      depth++
      continue
    }
    if (t.type === "lparen") {
      if (depth === 0) break
      depth--
      continue
    }
    if (depth > 0) continue
    if (
      isKeyword(t, "AND", "OR") &&
      beforeParen.length > 0
    ) {
      break
    }
    beforeParen.unshift(t)
    if (beforeParen.length >= 3) break
  }
  // IN ( … ) | NOT IN ( … ) → value list for the field two slots back.
  if (isKeyword(beforeParen.at(-1), "IN")) {
    const isNot = isKeyword(beforeParen.at(-2), "NOT")
    const fieldIdx = isNot ? beforeParen.length - 3 : beforeParen.length - 2
    const fieldTok = beforeParen[fieldIdx]
    if (fieldTok && fieldTok.type === "ident") {
      return makeValueContext(
        fieldTok.value,
        isNot ? "NOT IN" : "IN",
        prefix,
        tokenStart,
        tokenEnd,
        inString,
        catalog,
      )
    }
  }
  // MATCHES ( … ) → function-arg position.
  if (isKeyword(beforeParen.at(-1), "MATCHES")) {
    const fieldIdx = beforeParen.length - 2
    const fieldTok = beforeParen[fieldIdx]
    if (fieldTok && fieldTok.type === "ident") {
      return makeFunctionArgContext(fieldTok.value, prefix, tokenStart, tokenEnd)
    }
  }
  return makeFieldContext(prefix, tokenStart, tokenEnd, catalog)
}

// ─── Context constructors ───────────────────────────────────────────────

function makeFieldContext(
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
  catalog: FilterCatalogEntry[],
): AutocompleteContext {
  const all = catalog.map((f) => ({
    label: f.field,
    description: f.description,
    insert: f.field,
    appendSpace: true,
    kind: "field" as const,
  }))
  return {
    kind: "field",
    prefix,
    tokenStart,
    tokenEnd,
    needsQuoting: false,
    suggestions: filterAndSort(all, prefix),
  }
}

function makeOperatorContext(
  fieldName: string,
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
  catalog: FilterCatalogEntry[],
): AutocompleteContext {
  const def = catalog.find((f) => f.field === fieldName)
  const ops = def?.allowedOperators ?? Object.keys(OPERATOR_KEYS)
  const all = ops.map((op) => ({
    label: op,
    descriptionKey: OPERATOR_KEYS[op]
      ? `operators.${OPERATOR_KEYS[op]}`
      : undefined,
    insert: op,
    appendSpace: !TERMINAL_OPERATORS.has(op),
    kind: "operator" as const,
  }))
  return {
    kind: "operator",
    fieldName,
    prefix,
    tokenStart,
    tokenEnd,
    needsQuoting: false,
    suggestions: filterAndSort(all, prefix),
  }
}

function makeValueContext(
  fieldName: string,
  operator: string,
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
  inString: boolean,
  catalog: FilterCatalogEntry[],
): AutocompleteContext {
  const def = catalog.find((f) => f.field === fieldName)
  const enums = def?.enumValues ?? []
  // If we're inside a quoted literal, the insert replaces the inner text
  // and keeps the outer quotes. Otherwise we wrap with quotes ourselves.
  const all = enums.map((v) => ({
    label: v,
    description: undefined,
    insert: inString ? v : `'${v}'`,
    appendSpace: !inString,
    kind: "value" as const,
  }))
  return {
    kind: "value",
    fieldName,
    operator,
    prefix,
    tokenStart,
    tokenEnd,
    needsQuoting: !inString,
    suggestions: filterAndSort(all, prefix),
  }
}

function makeLogicContext(
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
): AutocompleteContext {
  const all = [
    {
      label: "AND",
      descriptionKey: "logic.and",
      insert: "AND",
      appendSpace: true,
      kind: "operator" as const,
    },
    {
      label: "OR",
      descriptionKey: "logic.or",
      insert: "OR",
      appendSpace: true,
      kind: "operator" as const,
    },
  ]
  return {
    kind: "logic",
    prefix,
    tokenStart,
    tokenEnd,
    needsQuoting: false,
    suggestions: filterAndSort(all, prefix),
  }
}

function makeFunctionArgContext(
  fieldName: string,
  prefix: string,
  tokenStart: number,
  tokenEnd: number,
): AutocompleteContext {
  const argsByField: Record<string, string[]> = {
    orders_placed: ["count", "sum_amount", "amount", "date"],
    products_purchased: ["id", "tag", "quantity", "sum_quantity", "date"],
    shopify_email: ["activity_id", "count", "date"],
    customer_within_distance: ["coordinates", "distance_km", "distance_mi"],
  }
  const keys = argsByField[fieldName] ?? [
    "count",
    "amount",
    "sum_amount",
    "date",
  ]
  const all = keys.map((k) => ({
    label: k,
    description: undefined,
    insert: k,
    appendSpace: true,
    kind: "value" as const,
  }))
  return {
    kind: "value",
    fieldName,
    prefix,
    tokenStart,
    tokenEnd,
    needsQuoting: false,
    suggestions: filterAndSort(all, prefix),
  }
}

function filterAndSort(
  list: AutocompleteSuggestion[],
  prefix: string,
): AutocompleteSuggestion[] {
  const p = prefix.toLowerCase()
  const matched = p
    ? list.filter((s) => s.label.toLowerCase().includes(p))
    : list
  return [...matched].sort((a, b) => {
    const ap = a.label.toLowerCase().startsWith(p) ? 0 : 1
    const bp = b.label.toLowerCase().startsWith(p) ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.label.localeCompare(b.label)
  })
}
