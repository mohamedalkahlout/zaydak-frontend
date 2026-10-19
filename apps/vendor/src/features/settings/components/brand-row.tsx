"use client"

import type { ReactNode } from "react"
import { CirclePlusIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

/**
 * The three pieces every group on the Brand screen is assembled from.
 *
 * Shopify's Brand page is one shape repeated eight times: a titled group, and
 * inside it a row that is either an **empty slot** — a dashed tile, what the
 * slot is for, and a single ⊕ that fills it — or the asset itself with a menu.
 * Pulling that shape out here is what keeps the logo, the colours, the slogan
 * and the social links reading as one screen rather than four controls that
 * happen to share a card.
 *
 * The row is deliberately **not** a click target. Every slot's add action is a
 * menu or a popover, whose trigger has to be a real focusable element, and a
 * button nested inside a button is invalid HTML — so the trailing control owns
 * the interaction and the row only lays it out.
 */
export function BrandGroup({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * The leading tile: dashed and empty until the slot is filled, solid once it
 * holds something. `wide` is for the two assets that are not square — the cover
 * image and a wordmark logo — so their preview is not letterboxed into nothing.
 */
export function BrandTile({
  filled,
  wide,
  className,
  children,
}: {
  filled?: boolean
  wide?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-muted-foreground transition-colors",
        wide ? "h-11 w-[68px]" : "size-11",
        filled
          ? "bg-muted ring-1 ring-foreground/10"
          : "border border-dashed border-foreground/25",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function BrandRow({
  tile,
  title,
  hint,
  action,
  className,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  tile: ReactNode
  title: ReactNode
  hint?: ReactNode
  /** The trailing control — the ⊕ that fills the slot, or the asset's menu. */
  action?: ReactNode
  className?: string
  onDragOver?: React.DragEventHandler
  onDragLeave?: React.DragEventHandler
  onDrop?: React.DragEventHandler
}) {
  return (
    <div
      className={cn("flex items-center gap-3", className)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {tile}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * The ⊕ at the end of an empty slot.
 *
 * It carries the row's label as its accessible name — "Add a default logo" is
 * on screen beside it, but a screen reader reaching a bare plus has nothing to
 * distinguish it from the seven other pluses on the page.
 */
export function BrandAddButton({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CirclePlusIcon className="size-5" />
    </button>
  )
}
