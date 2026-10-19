"use client"

import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

export function DataTableViewTabs({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  "aria-label": string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-0.5", className)}
    >
      {children}
    </div>
  )
}

export function DataTableViewTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
        selected && "bg-muted font-medium text-foreground ring-1 ring-foreground/10",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
