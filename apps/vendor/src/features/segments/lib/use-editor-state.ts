"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Expr,
  ParserError,
  parseShopifyQL,
  serializeShopifyQL,
  flattenConditions,
  getTopLogic,
  canRenderAsChipStrip,
  type FlatCondition,
  type TopLogic,
} from "@/features/segments/lib/shopifyql"

/**
 * AST-first editor state.
 *
 * The textarea (Phase 10B will swap it for CodeMirror) still owns the
 * literal text — that's where the user types. But every consumer that
 * wants to *reason* about the query (chip overlay, AI explain, validation)
 * goes through this hook.
 *
 * State machine:
 *
 *   text  ─────►  parsedAst | null
 *                 parseError | null
 *                 isValid: boolean
 *                 canRenderAsChips: boolean
 *
 * On mutation (chip delete / op swap / etc.), the consumer:
 *   1. Reads `ast`
 *   2. Calls one of the `shopifyql/mutate.ts` helpers
 *   3. Calls `setFromAst(nextAst)` to write the canonical string back
 *
 * `setText` is wired directly to the textarea's onChange so free-form
 * typing never clears the AST until the parse fails (then `ast === null`,
 * `parseError !== null`, and chip overlay hides itself).
 */

export interface EditorState {
  /** The raw text from the textarea (always authoritative for typing). */
  text: string
  /** Parsed AST when text is valid; `null` while invalid / empty. */
  ast: Expr | null
  /** Set when text fails to parse — contains line/column info. */
  parseError: ParserError | null
  /** Convenience: parseError === null && text.trim() !== "" */
  isValid: boolean
  /** Convenience: chip overlay can render this AST (Phase 10C). */
  canRenderAsChips: boolean
  /** Flat list of leaf conditions in source order (for chip rendering). */
  conditions: FlatCondition[]
  /** Top-level AND / OR / undefined (single condition). */
  topLogic: TopLogic | undefined
  /** Set the text — re-parses on the trailing edge of typing. */
  setText: (next: string) => void
  /** Set state from a freshly built AST (chip-overlay edits). */
  setFromAst: (next: Expr) => void
}

interface UseEditorStateOptions {
  initialText: string
  /** Called when the AST changes due to either text or chip mutations. */
  onTextChange?: (next: string) => void
  /** Debounce parsing while the user is typing (ms). */
  parseDebounceMs?: number
}

export function useEditorState({
  initialText,
  onTextChange,
  parseDebounceMs = 200,
}: UseEditorStateOptions): EditorState {
  const [text, setTextState] = useState(initialText)
  const [parsed, setParsed] = useState<{
    ast: Expr | null
    parseError: ParserError | null
  }>(() => parseSafe(initialText))

  // Track the last text we *parsed* so the debounce timer doesn't re-fire
  // for the value it already settled on. This matters because RHF's reset
  // path may push the same text through twice.
  const lastParsedRef = useRef<string>(initialText)

  // Keep that bookkeeping in step with outside-driven text (the mirror below).
  // From an effect, because a render-phase ref write is unsafe once React
  // discards a speculative render — and declared BEFORE the debounce effect so
  // the guard there sees the fresh value and skips a redundant re-parse of
  // text the mirror has already parsed.
  useEffect(() => {
    lastParsedRef.current = initialText
  }, [initialText])

  // Debounced re-parse on text input. We don't synchronously parse on
  // every keystroke — strict parsing is expensive enough on long queries
  // that synchronous parsing visibly stutters typing. The chip overlay is
  // happy to flicker off briefly while the parser catches up.
  useEffect(() => {
    if (text === lastParsedRef.current) return
    const handle = setTimeout(() => {
      lastParsedRef.current = text
      setParsed(parseSafe(text))
    }, parseDebounceMs)
    return () => clearTimeout(handle)
  }, [text, parseDebounceMs])

  // Outside-driven text changes (RHF reset after save, AI generation, etc.)
  // — keep our local mirror in sync. Adjusted during render rather than from
  // an effect: React discards this render and re-runs with the new text, where
  // an effect would first commit a frame of the editor still showing the query
  // that was just replaced. Keyed on `initialText` alone, as the old dependency
  // list was — local edits already route through `setText()`.
  const [mirroredFrom, setMirroredFrom] = useState(initialText)
  if (initialText !== mirroredFrom) {
    setMirroredFrom(initialText)
    setTextState(initialText)
    setParsed(parseSafe(initialText))
  }

  const setText = (next: string) => {
    setTextState(next)
    onTextChange?.(next)
  }

  const setFromAst = (nextAst: Expr) => {
    const nextText = serializeShopifyQL(nextAst)
    setTextState(nextText)
    setParsed({ ast: nextAst, parseError: null })
    lastParsedRef.current = nextText
    onTextChange?.(nextText)
  }

  const conditions = useMemo(
    () => (parsed.ast ? flattenConditions(parsed.ast) : []),
    [parsed.ast],
  )
  const topLogic = useMemo(
    () => (parsed.ast ? getTopLogic(parsed.ast) : undefined),
    [parsed.ast],
  )
  const canRenderAsChips = useMemo(
    () => (parsed.ast ? canRenderAsChipStrip(parsed.ast) : false),
    [parsed.ast],
  )

  return {
    text,
    ast: parsed.ast,
    parseError: parsed.parseError,
    isValid: parsed.parseError === null && text.trim() !== "",
    canRenderAsChips,
    conditions,
    topLogic,
    setText,
    setFromAst,
  }
}

function parseSafe(text: string): {
  ast: Expr | null
  parseError: ParserError | null
} {
  if (!text.trim()) return { ast: null, parseError: null }
  try {
    return { ast: parseShopifyQL(text), parseError: null }
  } catch (err) {
    if (err instanceof ParserError) {
      return { ast: null, parseError: err }
    }
    // Lexer errors also propagate here — treat them as parse failures so
    // the editor surfaces them in the error rail.
    return {
      ast: null,
      parseError: new ParserError(
        err instanceof Error ? err.message : String(err),
        0,
      ),
    }
  }
}
