"use client"

import { useState, type RefObject } from "react"
import { useMentionSearch } from "./use-mention-search"
import {
  detectMentionQuery,
  findMentionStart,
  mentionKey,
  serializeMentions,
  MENTION_CATEGORIES,
  type MentionCandidate,
  type MentionType,
} from "./mention-config"

/**
 * Binds the mention picker to a specific textarea. The two composers differ
 * only in how the text is stored:
 *   - uncontrolled (`vendor-agent-chat`) → `getValue`/`setValue` read/write
 *     `textareaRef.current.value`.
 *   - controlled (`ai-chat-panel`) → `getValue` returns the `draft` state,
 *     `setValue` is `setDraft`.
 * Everything else (state machine, keyboard nav, token splicing) is shared.
 */
export interface MentionComposerBinding {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  locale: "ar" | "en"
  getValue: () => string
  setValue: (next: string) => void
}

/**
 * All the @-mention behaviour for one composer: the hierarchical picker
 * state (root categories → entity results), the picked-chip list, keyboard
 * navigation, and the textarea token splicing. Presentational bits
 * (`MentionDropdown`, `MentionChips`) read the returned values; the composer
 * wires `onValueChange`/`onKeyDown` into its textarea and calls `serialize()`
 * + `reset()` on send.
 */
export function useMentionComposer({
  textareaRef,
  locale,
  getValue,
  setValue,
}: MentionComposerBinding) {
  // query: text typed after the active "@" (null = picker closed).
  // category: drilled-in category (null = root menu).
  const [query, setQuery] = useState<string | null>(null)
  const [category, setCategory] = useState<MentionType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [picked, setPicked] = useState<MentionCandidate[]>([])

  const search = useMentionSearch({
    category,
    query: query ?? "",
    locale,
    active: query !== null,
  })

  const rowCount =
    category === null ? MENTION_CATEGORIES.length : search.candidates.length

  const close = () => {
    setQuery(null)
    setCategory(null)
    setActiveIndex(0)
  }

  /** Feed every textarea change here (after the composer stores the value). */
  const onValueChange = (value: string, caret: number) => {
    const mq = detectMentionQuery(value, caret)
    if (mq === null) {
      close()
      return
    }
    // A freshly typed "@" opens the picker at the root category menu.
    if (query === null) setCategory(null)
    setQuery(mq)
    setActiveIndex(0)
  }

  // Collapse the active "@token" back to a bare "@" (drill-in / back), caret
  // left just past the "@". Returns false when no token is found.
  const collapseToken = (): boolean => {
    const ta = textareaRef.current
    const value = getValue()
    const caret = ta?.selectionStart ?? value.length
    const at = findMentionStart(value, caret)
    if (at === -1) return false
    const before = value.slice(0, at)
    const after = value.slice(caret)
    setValue(before + "@" + after)
    const nextCaret = at + 1
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(nextCaret, nextCaret)
    })
    return true
  }

  const pickCategory = (key: MentionType) => {
    if (!collapseToken()) return
    setCategory(key)
    setQuery("")
    setActiveIndex(0)
  }

  const goBack = () => {
    collapseToken()
    setCategory(null)
    setQuery("")
    setActiveIndex(0)
  }

  // Entity picked → chip; strip the "@token" from the text entirely.
  const pickCandidate = (candidate: MentionCandidate) => {
    const ta = textareaRef.current
    const value = getValue()
    const caret = ta?.selectionStart ?? value.length
    const at = findMentionStart(value, caret)
    const before = at === -1 ? value.slice(0, caret) : value.slice(0, at)
    const after = value.slice(caret)
    // Collapse a double-space left at the seam where the token was.
    const merged =
      before.endsWith(" ") && after.startsWith(" ")
        ? before + after.slice(1)
        : before + after
    setValue(merged)
    setPicked((prev) =>
      prev.some((m) => mentionKey(m) === mentionKey(candidate))
        ? prev
        : [...prev, candidate],
    )
    close()
    const nextCaret = before.length
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const removeMention = (key: string) =>
    setPicked((prev) => prev.filter((m) => mentionKey(m) !== key))

  /**
   * Handle a keydown while the picker owns the keyboard. Returns `true` when
   * the event was consumed, so the composer can skip its own Enter=send.
   */
  const onKeyDown = (e: React.KeyboardEvent): boolean => {
    if (query === null) return false
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (rowCount > 0) setActiveIndex((i) => (i + 1) % rowCount)
      return true
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (rowCount > 0) setActiveIndex((i) => (i - 1 + rowCount) % rowCount)
      return true
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      if (category === null) {
        const def = MENTION_CATEGORIES[activeIndex]
        if (def) pickCategory(def.key)
      } else {
        const c = search.candidates[activeIndex]
        if (c) pickCandidate(c)
      }
      return true
    }
    if (e.key === "Escape") {
      e.preventDefault()
      if (category !== null) goBack()
      else close()
      return true
    }
    // Empty query inside a category → step back to root instead of deleting.
    if (
      e.key === "Backspace" &&
      category !== null &&
      (query ?? "").length === 0
    ) {
      e.preventDefault()
      goBack()
      return true
    }
    return false
  }

  /** Clear chips + close the picker (call after a message is sent). */
  const reset = () => {
    setPicked([])
    close()
  }

  return {
    open: query !== null,
    // Close the picker without touching the picked chips — used when another
    // composer surface (the "+" menu) takes over, so the two never overlap.
    close,
    category,
    activeIndex: Math.min(activeIndex, Math.max(0, rowCount - 1)),
    candidates: search.candidates,
    loading: search.loading,
    picked,
    onValueChange,
    onKeyDown,
    pickCategory,
    pickCandidate,
    goBack,
    setActiveIndex,
    removeMention,
    reset,
    serialize: () => serializeMentions(picked),
  }
}
