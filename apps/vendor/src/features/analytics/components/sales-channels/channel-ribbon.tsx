"use client"

import type { PointerEvent } from "react"
import {
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import { cn } from "@/shared/lib/utils"
import type { SalesChannelRow } from "../../types"

/**
 * The channel mix as one thick rounded bar, split by share.
 *
 * Segments follow the tiles' order (largest first), so the ribbon reads left to
 * right — or right to left in Arabic, for free, because it is a flex row —
 * exactly as the tiles beneath it do. A 2px gap of card surface separates the
 * segments instead of a drawn border; the outer ends are clipped round by the
 * track. Widths animate with `flex-grow`, so flipping Sales / Orders morphs the
 * bar rather than redrawing it (and does not, under reduced motion).
 *
 * The whole bar is one `role="img"` with a spoken summary: the tiles below carry
 * every number, so the segments themselves stay presentational. Hovering a
 * segment (with a mouse — a tap has no "leave") highlights its tile.
 */
export function ChannelRibbon({
  rows,
  shares,
  label,
  focus,
  onFocusChange,
}: {
  /** Already in display order. */
  rows: readonly SalesChannelRow[]
  shares: Record<SalesChannel, number>
  label: string
  focus: SalesChannel | null
  onFocusChange: (channel: SalesChannel | null) => void
}) {
  const segments = rows.filter((row) => shares[row.channel] > 0)

  const hover =
    (channel: SalesChannel | null) => (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") onFocusChange(channel)
    }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex h-5 w-full gap-[2px] overflow-hidden rounded-full",
        segments.length === 0 && "bg-muted",
      )}
    >
      {segments.map((row) => (
        <div
          key={row.channel}
          data-channel={row.channel}
          onPointerEnter={hover(row.channel)}
          onPointerLeave={hover(null)}
          className={cn(
            "h-full min-w-1.5 basis-0 rounded-[3px] transition-[flex-grow,opacity] duration-500 ease-out motion-reduce:transition-none",
            focus && focus !== row.channel && "opacity-30",
          )}
          style={{
            flexGrow: shares[row.channel],
            backgroundColor: SALES_CHANNEL_META[row.channel].color,
          }}
        />
      ))}
    </div>
  )
}
