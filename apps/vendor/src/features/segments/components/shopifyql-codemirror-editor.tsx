"use client"

import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { EditorState, Compartment } from "@codemirror/state"
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view"
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
  indentOnInput,
} from "@codemirror/language"
import {
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab,
} from "@codemirror/commands"
import {
  autocompletion,
  closeBrackets,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete"
import { lintKeymap, lintGutter } from "@codemirror/lint"
import { tags as t } from "@lezer/highlight"
import { GET_FILTER_CATALOG } from "@/features/segments/api"
import {
  localizeFilterCatalog,
  type FilterCatalogEntry,
  type FilterCatalogResponse,
} from "@/features/segments/types"
import { shopifyqlLanguage } from "@/features/segments/lib/shopifyql/cm-language"
import { makeShopifyqlCompletionSource } from "@/features/segments/lib/shopifyql/cm-autocomplete"
import { shopifyqlLinter } from "@/features/segments/lib/shopifyql/cm-linter"
import type { Translate } from "@/shared/i18n/translator"
import { cn } from "@/shared/lib/utils"

/**
 * ShopifyQLCodeMirrorEditor — Phase 10B.
 *
 * The real-editor replacement for `shopifyql-editor.tsx`. Same props
 * (value / onChange / onRun / errorMessage) so it drops in 1-for-1.
 *
 * Wires the existing intelligence layer in:
 *   - syntax highlighting via `shopifyqlLanguage()`
 *   - autocomplete via `makeShopifyqlCompletionSource(catalog)`
 *   - error squigglies via `shopifyqlLinter()` (calls `parseShopifyQL`)
 *
 * The CodeMirror EditorView is created once and reused across renders.
 * Outside-driven value changes (template apply, AI generation, undo/redo
 * from the React-side history) trigger an imperative `dispatch` to keep
 * the document in sync without remounting the editor.
 */
interface ShopifyQLCodeMirrorEditorProps {
  value: string
  onChange: (next: string) => void
  onRun?: () => void
  placeholder?: string
  errorMessage?: string | null
}

const SHOW_PROJECTION =
  "customer_name, note, subscription_status, location, orders, amount_spent"

const PHASE_10B_HIGHLIGHT = HighlightStyle.define([
  { tag: t.keyword, class: "cm-shopifyql-keyword" },
  { tag: t.string, class: "cm-shopifyql-string" },
  { tag: t.number, class: "cm-shopifyql-number" },
  { tag: t.literal, class: "cm-shopifyql-literal" },
  { tag: t.operator, class: "cm-shopifyql-operator" },
  { tag: t.bool, class: "cm-shopifyql-bool" },
  { tag: t.punctuation, class: "cm-shopifyql-punct" },
  { tag: t.variableName, class: "cm-shopifyql-field" },
])

const SHOPIFYQL_THEME = EditorView.theme({
  "&": {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: "13px",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { padding: "8px 0" },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": {
    backgroundColor: "rgb(245 245 245 / 0.4)",
    color: "rgb(115 115 115)",
    border: "none",
    borderRight: "1px solid var(--border)",
    paddingLeft: "8px",
    paddingRight: "8px",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "rgb(82 82 82)",
  },
  ".cm-shopifyql-keyword": {
    fontWeight: "600",
    color: "rgb(29 78 216)",
  },
  ".cm-shopifyql-string": { color: "rgb(21 128 61)" },
  ".cm-shopifyql-number": { color: "rgb(194 65 12)" },
  ".cm-shopifyql-literal": { color: "rgb(107 33 168)" },
  ".cm-shopifyql-operator": { color: "rgb(82 82 82)", fontWeight: "500" },
  ".cm-shopifyql-bool": { color: "rgb(190 18 60)", fontWeight: "600" },
  ".cm-shopifyql-punct": { color: "rgb(115 115 115)" },
  ".cm-shopifyql-field": { color: "rgb(15 23 42)" },
  ".cm-tooltip": {
    border: "1px solid var(--border)",
    backgroundColor: "var(--popover)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    fontFamily: "inherit",
    padding: "4px 12px",
    fontSize: "12px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "rgb(241 245 249)",
    color: "rgb(15 23 42)",
  },
  ".cm-diagnostic-error": {
    borderLeft: "3px solid rgb(220 38 38)",
  },
})

export function ShopifyQLCodeMirrorEditor({
  value,
  onChange,
  onRun,
  placeholder = "amount_spent > 100",
  errorMessage,
}: ShopifyQLCodeMirrorEditorProps) {
  const t = useTranslations("segments.queryEditor")
  const locale = useLocale()
  const tAutocomplete = useTranslations("segments.autocomplete")
  const tDiagnostics = useTranslations("segments.diagnostics")
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  // The completion source and the linter word their text through these; the
  // effect below keeps them on the current locale's translators.
  const autocompleteTRef = useRef<Translate>(tAutocomplete)
  const diagnosticsTRef = useRef<Translate>(tDiagnostics)

  const { data: catalogData } = useQuery<FilterCatalogResponse>(
    GET_FILTER_CATALOG,
  )
  const catalogRef = useRef<FilterCatalogEntry[]>([])

  // Keep the latest callbacks, catalog and translators reachable from CM6's
  // dispatch handlers without recreating the EditorView on every render.
  // Written from an effect rather than during render: a render-phase ref
  // write is unsafe once React discards a speculative render. CM6 only reads
  // these from user input (and the linter's debounced pass), which cannot
  // happen before the commit that sets them.
  const catalog = catalogData?.customerSegmentFilters?.filters
  useEffect(() => {
    onChangeRef.current = onChange
    onRunRef.current = onRun
    catalogRef.current = localizeFilterCatalog(catalog ?? [], locale)
    autocompleteTRef.current = tAutocomplete
    diagnosticsTRef.current = tDiagnostics
  })

  // Build extensions once — the completion source reads the current
  // catalog through a ref so it doesn't need to be re-wired on updates.
  /* eslint-disable react-hooks/refs --
   * The refs below are handed to CodeMirror as callbacks, and CM6 only
   * invokes them from user input — a keystroke, Mod-Enter, a completion, the
   * linter's debounced pass — all of which are events, long after this memo
   * has run. The compiler cannot see past the handoff and assumes the worst.
   * Reading them eagerly here instead is what the refs exist to avoid: it
   * would rebuild the EditorView on every render, losing the cursor, the
   * selection and the undo history each time the parent re-renders.
   */
  const extensions = useMemo(() => {
    const placeholderCompartment = new Compartment()
    void placeholderCompartment
    return [
      lineNumbers(),
      drawSelection(),
      highlightActiveLine(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      history(),
      shopifyqlLanguage(),
      syntaxHighlighting(PHASE_10B_HIGHLIGHT),
      autocompletion({
        override: [
          makeShopifyqlCompletionSource(
            () => catalogRef.current,
            () => autocompleteTRef.current,
          ),
        ],
        activateOnTyping: true,
        defaultKeymap: true,
      }),
      shopifyqlLinter(() => diagnosticsTRef.current),
      lintGutter(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
        {
          key: "Mod-Enter",
          run: () => {
            onRunRef.current?.()
            return true
          },
        },
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const next = u.state.doc.toString()
          onChangeRef.current(next)
        }
      }),
      SHOPIFYQL_THEME,
    ]
  }, [])
  /* eslint-enable react-hooks/refs */

  // Mount the EditorView once.
  useEffect(() => {
    const parent = wrapperRef.current
    if (!parent || viewRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // We deliberately mount the view once. `extensions` is memoised to
    // the empty dep set; `value` is reconciled below via dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconcile outside-driven `value` updates (templates, AI generation,
  // undo/redo from the React-side history hook) without recreating the
  // view. Skip when the document already matches so we don't loop.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    })
  }, [value])

  const empty = value.length === 0

  return (
    <div className="relative flex flex-col gap-1.5">
      <div
        className={cn(
          "relative rounded-lg border bg-background",
          errorMessage ? "border-destructive" : "border-input",
        )}
      >
        {/* FROM / SHOW header (read-only) */}
        <div className="border-b border-border bg-muted/30 px-3 py-1.5 font-mono text-[12px] leading-5 text-muted-foreground/80">
          <div>
            <span className="font-semibold">FROM</span> customers
          </div>
          <div>
            <span className="font-semibold">SHOW</span> {SHOW_PROJECTION}
          </div>
          <div>
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              WHERE
            </span>
          </div>
        </div>

        {/* Editable WHERE clause — CodeMirror mounts here */}
        <div ref={wrapperRef} className="min-h-[2.5rem]" />

        {/* Placeholder (CSS-only because CM6's placeholder ext requires an
            extra package and we want to avoid the extra weight). */}
        {empty && (
          <div className="pointer-events-none absolute left-12 top-[68px] font-mono text-[13px] text-muted-foreground/50">
            {placeholder}
          </div>
        )}

        {/* ORDER BY footer (read-only) */}
        <div className="border-t border-border bg-muted/30 px-3 py-1.5 font-mono text-[12px] leading-5 text-muted-foreground/80">
          <span className="font-semibold">ORDER BY</span> updated_at
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t.rich("hint", {
          kbd: (chunks) => <kbd className="rounded border px-1">{chunks}</kbd>,
        })}
      </p>
    </div>
  )
}
