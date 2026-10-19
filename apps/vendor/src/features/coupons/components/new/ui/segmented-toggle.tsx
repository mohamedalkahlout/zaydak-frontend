"use client"

import { CheckIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedToggleProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel?: string
  className?: string
  /** Stretch the chips to fill the row. */
  fullWidth?: boolean
}

/**
 * Chip-style radio group. Each option is an individual rounded-full pill
 * with a check icon when active. Radio semantics preserved for a11y.
 */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  fullWidth,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap items-center gap-2",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-muted/60",
              fullWidth && "flex-1 justify-center",
            )}
          >
            {active && <CheckIcon className="size-3.5 shrink-0" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
