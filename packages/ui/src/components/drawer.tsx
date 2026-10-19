"use client"

import * as React from "react"
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog"

import { cn } from "../lib/utils"

// A bottom/side "drawer" built on Base UI's Dialog primitive and animated with
// tw-animate's `data-open`/`data-closed` keyframes — the same mechanism the
// project's Dialog uses (Base UI's Drawer-primitive transition, driven by
// `data-starting-style`, did not run reliably here). It keeps the shadcn Drawer
// API (Drawer, DrawerContent, DrawerTitle, …) so callers are unchanged, but the
// gesture-based swipe/snap of the real Drawer is not part of this version.
//
// **Drawers nest.** A `Drawer` rendered inside another one's content opens over
// it and the parent stays mounted, stepping back into a stack rather than
// unmounting — which is what lets a flow ask for one more thing without losing
// the screen that asked. Nesting is Base UI's own: it marks the child popup
// `data-nested`, marks every ancestor `data-nested-dialog-open`, counts the
// open children into `--nested-dialogs`, and renders **no backdrop for a
// nested dialog**, so four deep is one wash over the page rather than four
// stacked over each other. All that is missing from the primitive is what the
// stack looks like: the parent's step back (`NESTED_CLASSES`) and the child's
// shadow over it (`NESTED_CHILD_CLASSES`), both below.

type Side = "top" | "right" | "bottom" | "left"

const DIRECTION_TO_SIDE: Record<string, Side> = {
  up: "top",
  down: "bottom",
  left: "left",
  right: "right",
}

type DrawerContextValue = { side: Side; showSwipeHandle: boolean }
const DrawerContext = React.createContext<DrawerContextValue>({
  side: "bottom",
  showSwipeHandle: false,
})

function Drawer({
  swipeDirection = "down",
  showSwipeHandle = false,
  modal = true,
  ...props
}: DrawerPrimitive.Root.Props & {
  swipeDirection?: "up" | "down" | "left" | "right"
  showSwipeHandle?: boolean
}) {
  const side = DIRECTION_TO_SIDE[swipeDirection] ?? "bottom"
  const value = React.useMemo(
    () => ({ side, showSwipeHandle }),
    [side, showSwipeHandle],
  )
  return (
    <DrawerContext.Provider value={value}>
      <DrawerPrimitive.Root data-slot="drawer" modal={modal} {...props} />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/25 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

// Positioning + enter/exit slide per side.
// The bare tw-animate slide utilities translate by a full 100% of the element,
// so the sheet slides fully off-screen — no arbitrary value needed.
/**
 * How a parent steps back when a drawer opens inside it.
 *
 * The child covers the parent exactly — same edge, same size — so a parent
 * that only shrank would disappear behind it and the stack would look like a
 * single drawer whose content changed. Each level therefore moves *inward*,
 * off the edge it is anchored to, and the strip that appears past the child's
 * edge is the whole cue: it says the screen behind is still there and still
 * where it was. `--nested-dialogs` is the depth, so a fourth drawer shows
 * three strips rather than one.
 *
 * The transform origin is the anchored edge, so scaling narrows the slab
 * without lifting it off the side of the screen it is attached to.
 */
const NESTED_CLASSES: Record<Side, string> = {
  bottom:
    "origin-top data-nested-dialog-open:[translate:0_calc(var(--nested-dialogs)*-0.5rem)]",
  top: "origin-bottom data-nested-dialog-open:[translate:0_calc(var(--nested-dialogs)*0.5rem)]",
  left: "origin-right data-nested-dialog-open:[translate:calc(var(--nested-dialogs)*0.5rem)_0]",
  right:
    "origin-left data-nested-dialog-open:[translate:calc(var(--nested-dialogs)*-0.5rem)_0]",
}

/**
 * How the frontmost drawer reads as a child.
 *
 * The step back above is keyed on the parent (`data-nested-dialog-open`), and
 * nothing was keyed on the child (`data-nested`), so the drawer in front was
 * styled exactly like a lone one. A nested dialog has no backdrop of its own —
 * that is Base UI's, and deliberate — so nothing separated it from the strip
 * of its parent left showing: the two read as one slab with a seam.
 *
 * The popup's own `shadow-lg` falls downward, which lands on the page for a
 * top sheet and nowhere useful for the other three. So the child's shadow is
 * cast toward its **free edge** — the one opposite where it is anchored, and
 * the side the parent's strip is on — which is the same statement the dialog
 * stack makes with `data-nested:shadow-xl`: this one is in front of that one.
 * A drawer in the middle of a stack is both a child and a parent, and takes
 * both rules.
 */
const NESTED_CHILD_CLASSES: Record<Side, string> = {
  bottom: "data-nested:shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.3)]",
  top: "data-nested:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]",
  left: "data-nested:shadow-[12px_0_32px_-12px_rgb(0_0_0/0.3)]",
  right: "data-nested:shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.3)]",
}

const SIDE_CLASSES: Record<Side, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[calc(100dvh-3rem)] rounded-t-xl border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
  top: "inset-x-0 top-0 max-h-[calc(100dvh-3rem)] rounded-b-xl border-b data-open:slide-in-from-top data-closed:slide-out-to-top",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-open:slide-in-from-left data-closed:slide-out-to-left",
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-open:slide-in-from-right data-closed:slide-out-to-right",
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  const { side, showSwipeHandle } = React.useContext(DrawerContext)
  const horizontal = side === "left" || side === "right"

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        data-side={side}
        // The axis a call site styles its own content against — the panel in
        // a bottom sheet is an aspect-video block and in a side sheet it
        // fills the height. Named `group/drawer-popup` so that reads
        // `group-data-[swipe-axis=y]/drawer-popup:aspect-video` at the call
        // site, which is where the decision belongs: this component knows the
        // side, not what a screen wants to do about it.
        data-swipe-axis={horizontal ? "x" : "y"}
        className={cn(
          "group/drawer-popup fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-lg outline-none ring-1 ring-foreground/10",
          "duration-300 ease-out data-open:animate-in data-closed:duration-200 data-closed:ease-in data-closed:animate-out",
          // Separate from the open/close keyframes on purpose: those animate
          // `transform`, this animates `translate` and `scale`, so a drawer
          // opening over a parent and the parent stepping back are two
          // properties that never fight over the same declaration.
          "transition-[translate,scale] duration-300 ease-out data-nested-dialog-open:scale-[0.98]",
          NESTED_CLASSES[side],
          NESTED_CHILD_CLASSES[side],
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {showSwipeHandle && !horizontal ? (
          <div
            aria-hidden
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted"
          />
        ) : null}
        {children}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex shrink-0 flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
