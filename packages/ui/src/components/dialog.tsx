"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * How a dialog steps back when another one opens inside it.
 *
 * Only in `viewport` mode, and that is the whole reason it works: a centred
 * dialog cannot stack, because the two cards are centred independently and
 * the taller one swallows the shorter whole — a sign-up panel over a sign-in
 * panel would hide it completely, at which point "stacked behind" and
 * "replaced" look identical. So both cards go to the **top** of their
 * scroller the moment there is a stack (`self-start` on the nested one and on
 * anything holding a nested one), which makes their top edges the one thing
 * that is comparable; the parent then lifts by `--nested-dialogs` and the
 * strip that appears above the child is the cue. Heights no longer matter.
 *
 * `origin-top` so the slight narrowing pivots on that same edge rather than
 * eating the offset it just made.
 *
 * The card behind also drops its own close button while it is behind. It is
 * already inert — Base UI gives focus and pointers to the front card — but
 * two ✕ marks 32px apart read as one control drawn twice, and the strip is
 * meant to say "there is a card here", not to offer a second thing to press.
 *
 * Distance alone does not carry it: the strip is one white card's edge above
 * another white card, which reads as a double border rather than as depth. So
 * the card behind is also dimmed a step and the card in front casts a shadow
 * over it — the three together are what make it obvious there is something to
 * come back to, which is the only reason to stack instead of swap.
 */
const NESTED_CLASSES =
  "origin-top transition-[translate,scale,filter] duration-200 ease-out data-nested:self-start data-nested:shadow-xl data-nested-dialog-open:self-start data-nested-dialog-open:scale-[0.96] data-nested-dialog-open:brightness-95 data-nested-dialog-open:[translate:0_calc(var(--nested-dialogs)*-0.5rem)] data-nested-dialog-open:[&_[data-slot=dialog-close]]:opacity-0"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  scroll = "popup",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /**
   * Accessible name for the built-in close button, already localized by the
   * caller. Same contract as `SheetContent`: it defaults to English so an
   * unlocalized console reads sensibly, and a bilingual screen passes its own
   * string rather than opting out of the button and hand-rolling one — which
   * is what a caller had to do while this was hardcoded.
   */
  closeLabel?: string
  /**
   * What scrolls when the dialog is taller than the window.
   *
   * `popup` is the default and the historic shape: the dialog is pinned to
   * the centre of the viewport, and a caller that expects to overflow caps its
   * own height and scrolls inside itself. That is right for a dialog with its
   * own footer — a confirm, a form with sticky actions — where the buttons
   * must stay on screen while the body moves under them.
   *
   * `viewport` puts the dialog in a full-window scroller instead, so the bar
   * the reader drags is the window's own at the edge of the screen and the
   * whole card — heading, fields, primary action — travels with it. Short
   * content still sits centred; only once it is taller than the window does
   * anything scroll. Use it for a dialog that is simply a long panel, where an
   * inner scrollbar reads as a box inside a box and hides the action at the
   * bottom of it.
   *
   * It is also the mode that can **stack**: a dialog opened from inside
   * another one steps the parent back into a visible layer rather than hiding
   * it. See `NESTED_CLASSES`.
   */
  scroll?: "popup" | "viewport"
}) {
  const popup = (
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn(
        "z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        // Centring is the popup's own job in `popup` mode and the scroller's
        // in `viewport` mode — a `fixed` popup inside a scroll container
        // would sit still while its container moved.
        // `max-w-full` with it: the side gutter is the scroller's padding in
        // this mode, and keeping the popup's own would inset it twice.
        scroll === "viewport"
          ? cn("relative max-w-full", NESTED_CLASSES)
          : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={
            <Button
              variant="ghost"
              // `end-2`, not `right-2`: a dialog's close sits on the corner
              // the title ends at, which is the left one under RTL.
              className="absolute top-2 end-2"
              size="icon-sm"
            />
          }
        >
          <XIcon />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Popup>
  )

  return (
    <DialogPortal>
      <DialogOverlay />
      {scroll === "viewport" ? (
        // `min-h-full` on the inner row is what keeps a short dialog centred
        // and lets a tall one push the scroller instead: `items-center` in a
        // box that is exactly the window's height centres, and the same box
        // grows past it the moment the card does. The padding is the gutter a
        // scrolled-to-the-end card needs so it does not touch the edge.
        <div
          data-slot="dialog-viewport"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
        >
          {/*
            A stacked card starts lower than a lone one (`has-[>[data-nested]]`
            is this row holding a nested card), which is the other half of the
            step back: the parent lifts a little and the child begins a little
            further down, so the strip between them is the sum of the two and
            neither is pushed against the top of the window. Two levels deep
            leaves 32px of the card behind showing; three still shows all
            three edges.
          */}
          <div className="flex min-h-full items-center justify-center p-4 has-[>[data-nested]]:pt-10">
            {popup}
          </div>
        </div>
      ) : (
        popup
      )}
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel = "Close",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  /** Visible label on the optional footer Close button. See `DialogContent`. */
  closeLabel?: string
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          {closeLabel}
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
