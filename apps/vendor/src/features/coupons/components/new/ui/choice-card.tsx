"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface ChoiceCardProps {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  title: string
  description?: string
  disabled?: boolean
}

/**
 * Visual radio card: icon + title + optional description. Active state
 * draws a primary ring and fills the icon with primary tone. Used in
 * places a plain `<RadioRow>` would feel cramped.
 */
export function ChoiceCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  disabled,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-foreground/30 hover:bg-muted/40",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
      )}
    >
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <p className="text-sm font-medium leading-none">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground leading-snug">
          {description}
        </p>
      )}
    </button>
  )
}
