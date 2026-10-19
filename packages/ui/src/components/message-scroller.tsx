"use client"

import * as React from "react"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"
import { ArrowDownIcon } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "./button"

/**
 * The chat transcript scroller, over `@shadcn/react`'s headless
 * `MessageScroller`.
 *
 * What the primitive owns and this file does not re-implement: a new anchored
 * row (a user turn) lands near the top of the viewport with a peek of the
 * previous row above it; a reply streams into the room below it; following
 * the live edge only while the reader is at it, and any wheel, touch,
 * keyboard-scroll or programmatic jump releases it; opening at the last
 * anchored turn rather than the absolute bottom, with the viewport hidden
 * (`data-pending-scroll`) until that position is applied; and preserving the
 * visible row when older history is prepended.
 *
 * Two things here are ours. The scroll control renders through this package's
 * `Button`, so it is styled like every other control; and every
 * string is a prop (`label` on the button), because this package knows no
 * locale. The registry's scrollbar utilities are dropped on purpose — the
 * design tokens hide scrollbars globally.
 */
function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        // `data-pending-scroll` is set until the opening position has been
        // applied; hiding the viewport for that frame is what stops a saved
        // thread from flashing its oldest messages before jumping.
        "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain scroll-fade-b contain-content outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-pending-scroll:invisible",
        className,
      )}
      {...props}
    />
  )
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        // Rows stay in the DOM (selection, find-in-page, assistive tech) while
        // the browser skips paint work for the ones far off screen.
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className,
      )}
      {...props}
    />
  )
}

type MessageScrollerButtonProps = React.ComponentProps<
  typeof MessageScrollerPrimitive.Button
> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & {
    /** Already-localized accessible name; falls back to English. */
    label?: string
  }

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  variant = "outline",
  size = "icon-sm",
  label,
  ...props
}: MessageScrollerButtonProps) {
  const fallback = direction === "end" ? "Scroll to end" : "Scroll to start"
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      direction={direction}
      className={cn(
        "absolute start-1/2 -translate-x-1/2 rounded-full shadow-md transition-[translate,scale,opacity] duration-200 rtl:translate-x-1/2",
        // Inert while there is nothing to scroll toward: no focus stop, and
        // it slides out of the way rather than blinking off.
        "data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)]",
        "data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)]",
        "data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full",
        "data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">{label ?? fallback}</span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
}
