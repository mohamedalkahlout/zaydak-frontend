"use client"

import { useRef, type RefObject } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/shared/lib/utils"
import { Textarea } from "@repo/ui/components/textarea"
import { categoryLabel, mentionCategory } from "@/features/ai/lib/mention-config"
import type { MentionSegment } from "@/features/ai/lib/inline-mentions"
import {
  inlineMentionComboboxAria,
  INLINE_MENTION_MANAGED_ATTR,
  type InlineMentionComboboxState,
} from "@/features/ai/hooks/inline-mention-aria"

/**
 * The panel's composer input: an ordinary textarea with a mirrored backdrop
 * behind it that paints a tint under every @-mention the text contains.
 *
 * The trick is that only the *backdrop* is transparent. The textarea keeps its
 * real, visible text and its real caret and selection on top; the backdrop
 * draws nothing but the rounded rectangles. So there is no synthetic caret, no
 * contenteditable, and nothing to go wrong with IME, spellcheck or dictation —
 * the one thing that has to hold is that both boxes lay text out identically.
 *
 * That is why the typography is a single shared constant rather than repeated
 * classes: every value in it moves the glyphs, and a backdrop that disagrees
 * by one pixel puts the highlight beside the word instead of under it. The
 * horizontal padding comes from the shared `Textarea` rather than from the
 * call site, which is exactly the kind of split that makes this easy to get
 * wrong, so it is spelled out on both.
 *
 * Two classes here are load-bearing and look redundant:
 *   - `dark:bg-transparent` on the textarea. `@repo/ui`'s Textarea carries
 *     `dark:bg-input/30`, and the panel's own `bg-transparent` does not
 *     displace it (different variant group), so in dark mode the input would
 *     paint an opaque panel straight over the highlights behind it.
 *   - `relative` on the textarea. The backdrop is absolutely positioned and
 *     would otherwise paint over a statically-positioned sibling; positioning
 *     the textarea too puts DOM order back in charge, and it comes second.
 *
 * The picker itself is not rendered here — it lives in the composer's own
 * positioned wrapper, outside the NoiseBackground frame, which is
 * overflow-hidden and would clip a popup reaching past the pill.
 *
 * Accessibility is two halves, and the second one is specific to the inline
 * model. The first is ordinary combobox wiring: given `combobox`, the textarea
 * carries `role="combobox"`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant`, so the picker is announced as it opens and the
 * highlighted row is read as it moves. The second is that a *resolved* inline
 * reference has nothing left to announce — the chip model's removable,
 * labelled chip is gone, and `@Summer Hoodie` is now ordinary characters in
 * the draft — so a polite live region names the entity and its kind the moment
 * one is inserted. It is derived from `flash` and `segments`, the props a pick
 * already flows through, so there is no second notion of "what was inserted"
 * to drift from the highlight.
 */

/** Everything that decides where a glyph lands. Identical on both boxes. */
const TYPOGRAPHY = "px-2.5 py-1 text-sm leading-5"

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  /** The text and the caret offset, in that order. */
  onValueChange: (value: string, caret: number) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** Re-derive the trigger after a caret move that typed nothing. A click and
   *  a key release both move the caret without firing a change event. */
  onClick: () => void
  onKeyUp: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur: () => void
  onFocus: () => void
  /** The text split into plain runs and mention runs (`segmentMentions`). */
  segments: MentionSegment[]
  /** The token that was just inserted, flashed once so a mid-sentence pick
   *  is visible without hunting for the caret. */
  flash: string | null
  /** Picker state, from `useInlineMentionComposer().combobox`. Optional: a
   *  caller that omits it gets a plain textarea from React here, and the hook
   *  writes the same attributes onto the element itself instead. */
  combobox?: InlineMentionComboboxState
  placeholder?: string
  disabled?: boolean
}

export function MentionTextarea({
  textareaRef,
  value,
  onValueChange,
  onKeyDown,
  onClick,
  onKeyUp,
  onBlur,
  onFocus,
  segments,
  flash,
  combobox,
  placeholder,
  disabled,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("aiChat.mention")

  // The entity behind the token that was just inserted, matched exactly the
  // way the highlight below matches it — so the announcement and the tint can
  // never describe different runs.
  const inserted = flash
    ? (segments.find((seg) => seg.mention && seg.text === flash)?.mention ??
      null)
    : null
  // "@Summer Hoodie, Products": the token as typed, then its kind.
  const announcement =
    inserted && flash
      ? t("announce", {
          token: flash,
          category: categoryLabel(mentionCategory(inserted.type), t),
        })
      : ""

  const comboboxAria = combobox ? inlineMentionComboboxAria(combobox) : null

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent",
          TYPOGRAPHY,
        )}
      >
        {segments.map((seg, i) => {
          if (!seg.mention) return <span key={i}>{seg.text}</span>
          const def = mentionCategory(seg.mention.type)
          return (
            <span
              key={i}
              className={cn(
                // No horizontal padding: it would widen the run and push every
                // glyph after it out of step with the textarea underneath.
                // `box-decoration-clone` keeps a wrapped token rounded at both
                // ends of both lines.
                "box-decoration-clone rounded-[5px] py-[3px] ring-1 ring-inset ring-foreground/10",
                def.tint,
                seg.text === flash && "compose-token-pop",
              )}
            >
              {seg.text}
            </span>
          )
        })}
        {/* A textarea keeps a line box for the trailing newline; the backdrop
            has to as well, or the two disagree on scroll height. */}
        {"\n"}
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        {...(comboboxAria ?? {})}
        {...(combobox ? { [INLINE_MENTION_MANAGED_ATTR]: "react" } : {})}
        onChange={(e) =>
          onValueChange(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
          )
        }
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onClick={onClick}
        onBlur={onBlur}
        onFocus={onFocus}
        onScroll={(e) => {
          const backdrop = backdropRef.current
          if (!backdrop) return
          backdrop.scrollTop = e.currentTarget.scrollTop
          backdrop.scrollLeft = e.currentTarget.scrollLeft
        }}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className={cn(
          "relative block min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
          TYPOGRAPHY,
        )}
      />

      {/* Not `aria-hidden` like the backdrop — this is the only thing that says
          a resolved reference was inserted. It stays mounted and empty between
          picks, because a live region that arrives in the DOM already holding
          its message is not reliably announced. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  )
}
