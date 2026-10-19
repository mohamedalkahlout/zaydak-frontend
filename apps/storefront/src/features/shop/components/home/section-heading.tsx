"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

/**
 * The front page's section header, and the thing that makes it read as one
 * document rather than as a stack of unrelated widgets.
 *
 * Three parts, always in this order: a two-digit index, the title in the
 * display serif, and a hairline that runs from the title to the edge of the
 * gutter. The rule is the point — every section starts on the same line, so
 * the eye tracks down a spine instead of re-finding the left edge each time.
 *
 * The index is `tabular-nums` and padded to two digits so `01` and `10` occupy
 * the same width; a ragged column of numbers is exactly the detail that makes
 * a numbered layout look accidental.
 *
 * The "view all" link sits *after* the rule rather than opposite the title,
 * because a link floated to the far edge is the first thing a phone drops onto
 * its own line — and a heading that reflows into two rows on small screens is
 * how the rhythm breaks.
 */
export function SectionHeading({
  index,
  title,
  note,
  href,
  actionLabel,
  className,
}: {
  /** 1-based. Rendered zero-padded. */
  index: number
  title: string
  note?: string
  href?: string
  actionLabel?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="font-mono text-xs tracking-widest text-shop-accent tabular-nums"
        >
          {String(index).padStart(2, "0")}
        </span>

        <h2 className="font-heading text-shop-title font-semibold tracking-tight text-balance">
          {title}
        </h2>

        <span aria-hidden className="rule-line" />

        {href && actionLabel && (
          <Link
            href={href}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-shop-hairline bg-card px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-shop-accent hover:text-shop-accent sm:inline-flex"
          >
            {actionLabel}
            <ArrowRight className="size-3.5 rtl:-scale-x-100" />
          </Link>
        )}
      </div>

      {note && (
        <p className="max-w-prose ps-8 text-shop-body leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}

      {/* The same link again for the breakpoint the inline one is hidden at.
          Two nodes rather than one that moves, because moving it would mean a
          wrapper whose layout differs per breakpoint — and the rule has to stay
          unbroken at every width. */}
      {href && actionLabel && (
        <Link
          href={href}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-shop-accent ps-8 hover:underline sm:hidden"
        >
          {actionLabel}
          <ArrowRight className="size-3.5 rtl:-scale-x-100" />
        </Link>
      )}
    </div>
  )
}
