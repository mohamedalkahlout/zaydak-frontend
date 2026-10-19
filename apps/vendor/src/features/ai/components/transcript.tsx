"use client"

import type { ReactNode } from "react"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui/components/message-scroller"
import { cn } from "@/shared/lib/utils"

/**
 * The scroll surface both the full-page chat and the slide-in panel render
 * their turns into.
 *
 * Before this, each hand-rolled its own following and they disagreed. The
 * panel ran `scrollTop = scrollHeight` in an effect keyed on every streamed
 * token, so a vendor who scrolled up to re-read a card was yanked back on each
 * token — hundreds of times in the 168-second turn from the bug report, and
 * any text they were selecting was scrolled out from under them. The page had
 * a stick-to-bottom flag derived from `scroll` events, which its own smooth
 * `scrollIntoView` also fires, so following released and re-engaged on its own.
 *
 * `MessageScroller` (@repo/ui, over @shadcn/react) owns all of it now, and its
 * rules are the ones the vendor actually wanted:
 *
 * - Following happens only while the reader is at the live edge. A wheel,
 *   touch, keyboard scroll or scrollbar drag releases it; nothing re-engages
 *   it but returning to the edge or pressing the jump button.
 * - A new anchored row — the vendor's own message — lands near the TOP of the
 *   viewport with a peek of the previous turn above it, and the reply streams
 *   into the room below it, instead of the answer growing under their eye at
 *   the bottom edge.
 * - A reopened thread lands on the last anchored turn rather than the absolute
 *   bottom, and the viewport stays hidden until that position is applied, so
 *   there is no sweep through the whole history on every visit.
 * - Rows far off screen skip paint work but stay in the DOM for selection,
 *   find-in-page and screen readers.
 *
 * The host still owns what a row IS. It maps its own messages to
 * `TranscriptItem`s and marks the ones that start a turn.
 */

/** One row. `scrollAnchor` marks the row that starts a turn — the vendor's
 * own message — which is what the viewport anchors near the top. */
export const TranscriptItem = MessageScrollerItem

interface Props {
  /** Remounts the scroller so a switched conversation re-applies its opening
   * position. The conversation id is the right value. */
  resetKey: string
  /** True while a turn is in flight, so the log announces at a comfortable
   * pace instead of per token. */
  busy?: boolean
  /** Already-localized accessible name for the scroll region. */
  label: string
  /** Already-localized accessible name for the jump-to-latest control. */
  jumpLabel: string
  dir?: "rtl" | "ltr"
  className?: string
  /** Padding and column width live here — they differ between the page and
   * the panel, and they must be on the CONTENT, not the viewport, or the
   * scroller measures the padding as part of a row. */
  contentClassName?: string
  children: ReactNode
}

export function Transcript({
  resetKey,
  busy = false,
  label,
  jumpLabel,
  dir,
  className,
  contentClassName,
  children,
}: Props) {
  return (
    <MessageScrollerProvider
      key={resetKey}
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={56}
    >
      <MessageScroller className={cn("min-h-0 flex-1", className)}>
        <MessageScrollerViewport aria-label={label} dir={dir}>
          <MessageScrollerContent
            aria-busy={busy}
            className={cn("gap-4", contentClassName)}
          >
            {children}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton label={jumpLabel} />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
