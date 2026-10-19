import type { ReactNode } from "react"

import { cn } from "@/shared/lib/utils"

interface EmptyStateProps {
  /** Illustration shown above the title — typically one of the inventory SVGs. */
  illustration?: ReactNode
  title: string
  description: string
  /** Primary CTA(s). Rendered centered under the description. */
  action?: ReactNode
  /** Optional muted "Learn more …" line below the card. */
  footer?: ReactNode
  className?: string
}

/**
 * Shopify-style empty state: a centered illustration + heading + supporting
 * copy + CTA inside a bordered card. Used when a list/table is *truly* empty
 * (no filters applied). For "filtered to zero" use {@link EmptyStateInline}.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  footer,
  className,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 pt-14 pb-10 text-center",
          className
        )}
      >
        {illustration}
        <h2 className="mt-6 text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-6 flex items-center gap-2">{action}</div>}
      </div>
      {footer && (
        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      )}
    </div>
  )
}

/**
 * Compact empty state that lives *inside* an existing card/toolbar — shown when
 * filters or a search query exclude every row.
 */
export function EmptyStateInline({
  icon,
  title,
  description,
}: {
  icon?: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon}
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
