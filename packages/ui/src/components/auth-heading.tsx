import * as React from "react"

import { cn } from "../lib/utils"

/**
 * The heading block every auth screen opens with: the title and an optional
 * supporting line. `eyebrow` is accepted and not drawn — the mono wayfinding
 * label was retired on 2026-09-25, and the screens still pass it.
 *
 * Presentational — every string arrives already localized.
 */
export function AuthHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-1.5", className)}>
      <h1 className="font-heading text-2xl font-bold tracking-wide text-balance rtl:tracking-normal">
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-balance text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
