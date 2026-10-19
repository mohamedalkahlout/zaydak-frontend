"use client"

import { useRef, type KeyboardEvent } from "react"
import { cn } from "@/shared/lib/utils"
import type { ChannelMeasure } from "../../lib/channel-mix"

const MEASURES: ChannelMeasure[] = ["sales", "orders"]

/**
 * The section's Sales / Orders switch.
 *
 * A radio group rather than `Tabs`: it changes what every figure below it
 * measures, it does not swap one panel for another, so there is no tab panel
 * for a tab to control. It borrows `TabsList`'s look (muted track, raised
 * active segment) so it still reads as the same family of control. Arrow keys
 * move the selection as they do in any radio group; with two options either
 * direction simply flips it, which also makes it direction-agnostic in RTL.
 */
export function MeasureToggle({
  value,
  onChange,
  label,
  labels,
}: {
  value: ChannelMeasure
  onChange: (value: ChannelMeasure) => void
  label: string
  labels: Record<ChannelMeasure, string>
}) {
  const refs = useRef<Record<ChannelMeasure, HTMLButtonElement | null>>({
    sales: null,
    orders: null,
  })

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return
    }
    event.preventDefault()
    const next = value === "sales" ? "orders" : "sales"
    onChange(next)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground"
    >
      {MEASURES.map((measure) => {
        const active = value === measure
        return (
          <button
            key={measure}
            ref={(el) => {
              refs.current[measure] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(measure)}
            onKeyDown={onKeyDown}
            className={cn(
              "inline-flex h-full items-center rounded-md border border-transparent px-2.5 text-xs font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] duration-150",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
            )}
          >
            {labels[measure]}
          </button>
        )
      })}
    </div>
  )
}
