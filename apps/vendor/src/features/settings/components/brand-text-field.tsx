"use client"

import { useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { BrandAddButton, BrandRow, BrandTile } from "./brand-row"

/**
 * A written brand asset — the slogan and the short description — as the same
 * empty slot the images and the colours use.
 *
 * The field itself is not rendered until there is something to render it for.
 * That is what lets eight slots share one screen: an unset one costs a line,
 * and the vendor who has nothing to say about their slogan is not scrolling
 * past an empty textarea to reach the social links.
 *
 * Whether the slot is open is **local** state and deliberately not staged. A
 * revealed-but-empty field is not an edit — the contextual save bar has to mean
 * "you changed something", so opening a slot and walking away must leave it
 * closed with nothing to discard.
 */
export function BrandTextField({
  icon: Icon,
  addLabel,
  value,
  max,
  softMax,
  children,
}: {
  icon: LucideIcon
  /** Shown while the slot is empty — "Add a slogan". */
  addLabel: string
  value: string
  /** Hard cap, mirrored on the input by the caller. */
  max?: number
  /** Advisory cap — counted past, never truncated. */
  softMax?: number
  children: React.ReactNode
}) {
  const [opened, setOpened] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const open = opened || value.length > 0

  // Focus what the plus just revealed. A DOM effect rather than a handler:
  // the field does not exist yet at the moment the click is handled.
  useEffect(() => {
    if (!opened) return
    ref.current
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      ?.focus()
  }, [opened])

  if (!open) {
    return (
      <BrandRow
        tile={
          <BrandTile>
            <Icon className="size-4" />
          </BrandTile>
        }
        title={addLabel}
        action={
          <BrandAddButton label={addLabel} onClick={() => setOpened(true)} />
        }
      />
    )
  }

  const limit = max ?? softMax
  return (
    <div ref={ref} className="flex flex-col">
      {children}
      {limit !== undefined && (
        <Counter value={value.length} max={limit} soft={max === undefined} />
      )}
    </div>
  )
}

/**
 * `soft` means the limit is guidance, not a cap — the back-end accepts a
 * 10,000-character description, but a short description that runs past a couple
 * of hundred stops being short. A hard limit here would silently truncate
 * something a vendor wrote elsewhere.
 */
function Counter({
  value,
  max,
  soft,
}: {
  value: number
  max: number
  soft?: boolean
}) {
  const over = value > max
  return (
    <p
      className={cn(
        "mt-1.5 text-end text-xs tabular-nums",
        over && soft
          ? "text-amber-600 dark:text-amber-500"
          : "text-muted-foreground",
      )}
    >
      {value}/{max}
    </p>
  )
}
