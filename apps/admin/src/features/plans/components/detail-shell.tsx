"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"

interface Props {
  /** Where the list this record came from lives. */
  backHref: string
  backLabel: string
  title: string
  subtitle?: React.ReactNode
  /** Rendered beside the title — a status badge, a code chip. */
  meta?: React.ReactNode
  tabs: { href: string; label: string; active: boolean }[]
  children: React.ReactNode
}

/**
 * The chrome a detail screen wears: the way back to its list, what record it
 * is, and the tabs within it.
 *
 * One component for both plans and subscribers because the shape is the same
 * and the alternative is two files that drift. The tabs are `Link`s, not local
 * state: each is already a URL, which is what makes "the overrides on this
 * store" something an admin can paste into a message.
 */
export function DetailShell({
  backHref,
  backLabel,
  title,
  subtitle,
  meta,
  tabs,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          {backLabel}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">{title}</h1>
          {meta}
        </div>
        {subtitle && (
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab.active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}

/** The tab list a detail shell needs, built from a route helper. */
export function buildTabs<T extends string>(
  tabs: readonly T[],
  current: T,
  href: (tab: T) => string,
  label: (tab: T) => string,
): { href: string; label: string; active: boolean }[] {
  return tabs.map((tab) => ({
    href: href(tab),
    label: label(tab),
    active: tab === current,
  }))
}

/** Whatever a mutation had to say, success or failure, in one place. */
export function ActionResult({
  error,
  notice,
}: {
  error?: string | null
  notice?: string | null
}) {
  if (!error && !notice) return null
  return error ? (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  ) : (
    <p className="rounded-md bg-muted px-3 py-2 text-sm">{notice}</p>
  )
}
