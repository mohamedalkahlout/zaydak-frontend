"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { useMentionSearch } from "./use-mention-search"
import {
  detectMentionQuery,
  findMentionStart,
  mentionKey,
  MENTION_CATEGORIES,
  type MentionCandidate,
  type MentionType,
} from "./mention-config"
import {
  insertMentionText,
  mentionSpanAt,
  mentionToken,
  segmentMentions,
  serializeInlineMentions,
} from "./inline-mentions"
import { caretAnchor, type CaretAnchor } from "./caret-anchor"
import {
  applyInlineMentionComboboxAria,
  INLINE_MENTION_LISTBOX_ID,
  INLINE_MENTION_MANAGED_ATTR,
  inlineMentionOptionId,
  type InlineMentionComboboxState,
} from "../hooks/inline-mention-aria"

/**
 * The slide-in panel's @-mention composer.
 *
 * It is a sibling of `use-mention-composer`, not a replacement for it: that
 * hook drives the full-page chat's *chip* model and both of its bindings
 * (controlled and uncontrolled), and it keeps doing so untouched. This one is
 * panel-only and deliberately narrower — the panel's textarea is controlled,
 * and a backdrop mirrored against the text can only be drawn against a value
 * React actually renders, so `value`/`setValue` are the whole contract.
 *
 * What differs beyond that is where a picked entity goes. The chip model lifts
 * it out of the text; here it stays in the text as `@Display`, painted by the
 * backdrop. `resolved` is therefore a lookup rather than a record of intent —
 * the text is the truth, and the outgoing `[Referenced: …]` tail is rebuilt
 * from it on every send (see `inline-mentions.ts`).
 *
 * The hierarchy is unchanged from the chip picker, because the five entity
 * kinds cannot be searched as one list: `@` opens the categories, a category
 * drills into its own search. Picking a category collapses the typed token
 * back to a bare `@` rather than inserting anything, so the anchor the picker
 * is positioned against never moves while the vendor narrows the query.
 *
 * Being the state machine, it is also the only place that can answer what a
 * screen reader needs to know, so it returns `combobox` — open, the listbox it
 * controls, and the id of the row `activeIndex` highlights. `MentionTextarea`
 * renders those as attributes when it is handed them; when it is not, the
 * effect at the bottom writes the same attributes onto the textarea this hook
 * already owns imperatively (it focuses it and moves its caret), and stands
 * down the moment the element says React is rendering them. One owner at a
 * time, and the attributes themselves are defined once in
 * `hooks/inline-mention-aria.ts` so the two paths cannot describe the picker
 * differently.
 */

// `useLayoutEffect` warns when React renders on the server. The panel is a
// client component but is still rendered during SSR, so the measure pass falls
// back to `useEffect` there — it has nothing to do before hydration anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

/** Keys the open picker consumes on keydown; see `onKeyUp`. */
const PICKER_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"])

export interface InlineMentionComposerBinding {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /** The composer's own positioned wrapper — the picker's containing block. */
  anchorRef: RefObject<HTMLElement | null>
  value: string
  setValue: (next: string) => void
  locale: "ar" | "en"
}

export function useInlineMentionComposer({
  textareaRef,
  anchorRef,
  value,
  setValue,
  locale,
}: InlineMentionComposerBinding) {
  // query: the text typed after the active "@" (null = picker closed).
  // category: the drilled-in kind (null = root menu).
  const [query, setQuery] = useState<string | null>(null)
  const [category, setCategory] = useState<MentionType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [resolved, setResolved] = useState<MentionCandidate[]>([])
  /**
   * How the picker came to be open, which is what tells two identical-looking
   * states apart: `(category set, query "")` is reached both by *typing*
   * `@coupon` and by the caret merely landing inside an already-resolved
   * `@SALE20`. In the first the picker hangs off an "@" the vendor just typed,
   * so Backspace should step back to the root rather than eat it. In the second
   * the vendor is editing ordinary existing text and Backspace must delete a
   * character — swallowing it makes the first Backspace after clicking into a
   * token do nothing at all.
   */
  const [openedOn, setOpenedOn] = useState<"trigger" | "token" | null>(null)
  const [anchor, setAnchor] = useState<CaretAnchor | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // Where the caret belongs once React has committed a spliced value. Written
  // from an event, read from the layout effect below — never during render.
  const pendingCaretRef = useRef<number | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useMentionSearch({
    category,
    query: query ?? "",
    locale,
    active: query !== null,
  })

  const rowCount =
    category === null ? MENTION_CATEGORIES.length : search.candidates.length
  // The row the menu actually highlights. `activeIndex` can outrun the list —
  // arrow past row 5 while the 180ms-debounced search is still showing the
  // previous, longer results and the next response is shorter — and Enter must
  // pick the row the vendor can see rather than swallow itself on a gap.
  const activeRow = Math.min(activeIndex, Math.max(0, rowCount - 1))

  /**
   * The combobox relationship, as the textarea has to state it. `rowCount` is
   * what gates `activeOptionId`: a category that matched nothing renders a
   * listbox with no rows in it, and naming a row that is not there is the one
   * way `aria-activedescendant` fails silently — the reader announces nothing
   * and the arrow keys read as dead.
   */
  const combobox: InlineMentionComboboxState = useMemo(
    () => ({
      open: query !== null,
      listboxId: INLINE_MENTION_LISTBOX_ID,
      activeOptionId:
        query !== null && rowCount > 0
          ? inlineMentionOptionId(activeRow)
          : null,
    }),
    [query, rowCount, activeRow],
  )

  const segments = useMemo(
    () => segmentMentions(value, resolved),
    [value, resolved],
  )

  const close = useCallback(() => {
    setQuery(null)
    setCategory(null)
    setActiveIndex(0)
    setAnchor(null)
    setOpenedOn(null)
  }, [])

  /**
   * Re-anchor on the "@" that opened the token, not on the caret: the caret
   * walks right as the query is typed, and a picker that walked with it would
   * drift away from the word it is filtering.
   */
  const measure = useCallback(
    (text: string, caret: number) => {
      const ta = textareaRef.current
      const host = anchorRef.current
      if (!ta || !host) return
      const at = findMentionStart(text, caret)
      setAnchor(caretAnchor(ta, host, at === -1 ? caret : at, text))
    },
    [textareaRef, anchorRef],
  )

  /** Feed every textarea change here, after the composer has stored it. */
  const onValueChange = useCallback(
    (next: string, caret: number) => {
      const typed = detectMentionQuery(next, caret)
      if (typed === null) {
        close()
        return
      }
      // A freshly typed "@" opens at the root; one already open keeps its
      // category so the query keeps filtering inside it.
      if (query === null) setCategory(null)
      setOpenedOn("trigger")
      setQuery(typed)
      setActiveIndex(0)
      measure(next, caret)
    },
    [query, close, measure],
  )

  /**
   * Re-derive the trigger from the LIVE textarea — its value and, crucially,
   * its caret. `onValueChange` only runs on a change event, so without this
   * every caret move that types nothing leaves the machine stale: clicking
   * back into an existing token does not reopen the picker, and arrowing out
   * of one does not close it. The reference composer this was ported from
   * re-ran the same detection on click and on key release for that reason.
   */
  const refresh = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const caret = ta.selectionStart ?? ta.value.length
    // The caret landed inside a mention that is already resolved. Its KIND is
    // settled, so opening the category menu would ask a question that is
    // already answered — go straight to that entity's own list, which is what
    // a vendor clicking a coupon token is asking to see.
    const span = mentionSpanAt(ta.value, caret, resolved)
    if (span) {
      setCategory(span.mention.type)
      setOpenedOn("token")
      setQuery("")
      setActiveIndex(0)
      measure(ta.value, caret)
      return
    }
    onValueChange(ta.value, caret)
  }, [textareaRef, resolved, measure, onValueChange])

  /** Keys the picker owns while open — a keyup on one of them must not
   *  re-derive the trigger, or it undoes the keydown that consumed it. */
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape closed the picker on keydown while the caret is still inside
      // the token; re-detecting here would reopen what was just dismissed.
      if (e.key === "Escape") return
      if (query !== null && PICKER_KEYS.has(e.key)) return
      refresh()
    },
    [query, refresh],
  )

  /**
   * Close when the composer loses focus, after a beat. Rows pick on
   * `mousedown` and never take focus, so this only fires for the ways focus
   * genuinely leaves — the "+" menu, the mic, a click elsewhere on the page.
   * Without it the picker was never dismissed by clicking away, which is what
   * left it parked on a drilled-in category while the vendor reached for the
   * "+" menu again, where a fresh "@" then looked like it did nothing.
   */
  const onBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null
      close()
    }, 120)
  }, [close])

  const onFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
  }, [])

  /**
   * Move the caret now rather than queueing it, for a splice that did not
   * change the string. React bails out of an identical `setState`, so the
   * restore effect below — keyed on the value — never runs, and a queued caret
   * would sit armed until the NEXT keystroke and then yank the caret back in
   * front of the character just typed. That is the ordinary flow, not an edge:
   * typing "@" and picking a category immediately collapses "@" to "@".
   */
  const applyCaretNow = useCallback(
    (position: number) => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(position, position)
    },
    [textareaRef],
  )

  /** Collapse the active "@token" back to a bare "@" (drill in / step back). */
  const collapseToken = useCallback(() => {
    const ta = textareaRef.current
    const caret = ta?.selectionStart ?? value.length
    // Nothing to collapse inside a resolved mention: there is no half-typed
    // query there, and rewriting the run would eat the entity. Callers treat
    // false as "close", which is the right answer for a settled token.
    if (mentionSpanAt(value, caret, resolved)) return false
    const at = findMentionStart(value, caret)
    if (at === -1) return false
    const next = value.slice(0, at) + "@" + value.slice(caret)
    if (next === value) {
      applyCaretNow(at + 1)
      return true
    }
    setValue(next)
    pendingCaretRef.current = at + 1
    return true
  }, [textareaRef, value, setValue, applyCaretNow, resolved])

  // Both levels close rather than half-apply when the caret has wandered off
  // the token — clicking elsewhere in the draft does not close the picker, and
  // a row that silently does nothing reads as a broken menu.
  const pickCategory = useCallback(
    (key: MentionType) => {
      if (!collapseToken()) {
        close()
        return
      }
      setCategory(key)
      setOpenedOn("trigger")
      setQuery("")
      setActiveIndex(0)
    },
    [collapseToken, close],
  )

  const goBack = useCallback(() => {
    if (!collapseToken()) {
      close()
      return
    }
    setCategory(null)
    setQuery("")
    setActiveIndex(0)
  }, [collapseToken, close])

  /**
   * The "+ → Mention" command: drop an "@" at the caret and open at the root.
   *
   * Deliberately NOT routed through `onValueChange`. That is the typing path,
   * and it keeps the drilled-in category on purpose so a query keeps filtering
   * inside it — which meant that pressing Mention while the picker was already
   * parked on, say, Coupons wrote an "@" and changed no state the popup
   * renders from, so the command read as dead. A command is not a keystroke:
   * a new mention always starts at the root, whatever level was on screen.
   */
  const openAtCaret = useCallback(() => {
    const ta = textareaRef.current
    const caret = ta?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    // A token only opens at a word boundary, so give it one.
    const token = before.length > 0 && !/\s$/.test(before) ? " @" : "@"
    const next = before + token + value.slice(caret)
    const nextCaret = before.length + token.length
    if (next === value) applyCaretNow(nextCaret)
    else {
      pendingCaretRef.current = nextCaret
      setValue(next)
    }
    setCategory(null)
    setQuery("")
    setActiveIndex(0)
    measure(next, nextCaret)
  }, [textareaRef, value, setValue, applyCaretNow, measure])

  const pickCandidate = useCallback(
    (candidate: MentionCandidate) => {
      const ta = textareaRef.current
      const caret = ta?.selectionStart ?? value.length
      // Swapping a resolved mention replaces the whole token, not the part
      // of it before the caret.
      const spliced = insertMentionText(
        value,
        caret,
        candidate,
        mentionSpanAt(value, caret, resolved),
      )
      if (spliced.next === value) applyCaretNow(spliced.caret)
      else {
        pendingCaretRef.current = spliced.caret
        setValue(spliced.next)
      }
      setResolved((prev) =>
        prev.some((m) => mentionKey(m) === mentionKey(candidate))
          ? prev
          : [...prev, candidate],
      )
      close()
      setFlash(mentionToken(candidate))
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlash(null), 520)
    },
    [textareaRef, value, setValue, close, applyCaretNow, resolved],
  )

  /**
   * Handles a keydown while the picker owns the keyboard. Returns `true` when
   * the event was consumed, so the composer skips its own Enter = send. Escape
   * is `preventDefault`ed on the way out, which is also what stops the panel's
   * document-level Escape handler from closing the whole panel behind it.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
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
        const def = category === null ? MENTION_CATEGORIES[activeRow] : undefined
        const candidate =
          category === null ? undefined : search.candidates[activeRow]
        // A category that matched nothing has no row to open. Hand the key
        // back rather than eating it: swallowing Enter here left a vendor
        // staring at "No matches" unable to send the message they had typed.
        if (!def && !candidate) return false
        e.preventDefault()
        if (def) pickCategory(def.key)
        else if (candidate) pickCandidate(candidate)
        return true
      }
      if (e.key === "Escape") {
        e.preventDefault()
        if (category !== null) goBack()
        else close()
        return true
      }
      // Backspace on an empty query steps back to the root rather than
      // deleting the "@" the picker is hanging off — but only when that "@" is
      // one the vendor just typed. A picker opened by the caret landing inside
      // an already-resolved token is sitting on ordinary text, and there
      // Backspace has to delete like it does anywhere else.
      if (
        e.key === "Backspace" &&
        category !== null &&
        query.length === 0 &&
        openedOn === "trigger"
      ) {
        e.preventDefault()
        goBack()
        return true
      }
      return false
    },
    [
      query,
      category,
      openedOn,
      activeRow,
      rowCount,
      search.candidates,
      pickCategory,
      pickCandidate,
      goBack,
      close,
    ],
  )

  // Put the caret where the splice left it. DOM-only — nothing here sets
  // state, so the measuring pass stays clear of `set-state-in-effect`.
  useIsomorphicLayoutEffect(() => {
    const pending = pendingCaretRef.current
    if (pending === null) return
    pendingCaretRef.current = null
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(pending, pending)
  }, [value, textareaRef])

  // Combobox semantics for a composer that does not render them itself. DOM
  // only, like the caret restore above — nothing here sets state. The bail-out
  // is the handoff: once the textarea is passed `combobox` and renders the
  // attributes from React, this writes nothing at all.
  useIsomorphicLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (ta.getAttribute(INLINE_MENTION_MANAGED_ATTR) === "react") return
    applyInlineMentionComboboxAria(ta, combobox)
  }, [combobox, textareaRef])

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    },
    [],
  )

  /** Drop the lookup and close the picker (call after a message is sent). */
  const reset = useCallback(() => {
    setResolved([])
    setFlash(null)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    close()
  }, [close])

  const serialize = useCallback(
    () => serializeInlineMentions(value, resolved),
    [value, resolved],
  )

  return {
    open: query !== null,
    category,
    /** Pass to `MentionTextarea`'s `combobox` prop. */
    combobox,
    activeIndex: activeRow,
    candidates: search.candidates,
    loading: search.loading,
    failed: Boolean(search.error),
    anchor,
    segments,
    flash,
    onValueChange,
    onKeyDown,
    onKeyUp,
    onBlur,
    onFocus,
    refresh,
    openAtCaret,
    pickCategory,
    pickCandidate,
    goBack,
    setActiveIndex,
    close,
    reset,
    serialize,
  }
}
