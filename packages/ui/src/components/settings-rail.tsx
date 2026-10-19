"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { cn } from "../lib/utils"
import { Input } from "./input"

export interface SettingsRailItem {
  /** Stable key, and what the caller matches on to decide `active`. */
  id: string
  /** Already-localized. The filter box matches against this string. */
  label: string
  /** Sized and placed by the rail, so every entry lines up. */
  icon?: React.ComponentType<{ className?: string }>
  /** The caller decides. One entry at most, or none. */
  active?: boolean
}

/**
 * What the rail computes for an entry and the call site must spread onto
 * whatever element it renders — the shared face of a rail entry.
 */
export interface SettingsRailItemProps {
  className: string
  "aria-current": "page" | undefined
  children: React.ReactNode
}

export interface SettingsRailProps {
  /** Already-localized. */
  title: React.ReactNode
  /** Already-localized. Omitted entirely when absent — an empty line still claims its height. */
  subtitle?: React.ReactNode
  /** Content of the 36px badge beside the title: an icon, a logo, initials. */
  badge?: React.ReactNode
  items: SettingsRailItem[]
  /**
   * How one entry is rendered. The rail is deliberately agnostic about
   * navigation — see the note on the component.
   */
  renderItem: (
    item: SettingsRailItem,
    props: SettingsRailItemProps,
  ) => React.ReactNode
  /** Already-localized placeholder for the filter box. */
  searchPlaceholder: string
  /** Already-localized `aria-label` for the filter box. Defaults to the placeholder. */
  searchLabel?: string
  /** Already-localized line shown when the filter matches nothing. */
  emptyLabel: string
  /** Optional block under the list, above the card's bottom edge, with a divider. */
  footer?: React.ReactNode
  /** Merged onto the `<aside>`. The sticky offset is the usual reason. */
  className?: string
}

/**
 * The left rail card: a titled header, a filter box, and the list of sections.
 *
 * Two screens draw it — the vendor dashboard's settings overlay and the admin
 * console's integrations screen — and before this their markup was identical
 * character for character, down to the entry's class string and the empty
 * state. The shells around it are not shared and deliberately stay apart: one
 * is a fixed overlay over the dashboard, the other a full-height page with the
 * app sidebar dropped.
 *
 * **It knows nothing about navigation, on purpose.** The vendor's sections used
 * to be panes swapped in local state and the admin's have always been routes;
 * an entry is therefore whatever `renderItem` returns — a `Link`, a `button`,
 * an `<a>` — and which one is lit is the caller's `active` flag rather than
 * anything this component derives. Baking in `next/link` would have made the
 * rail a router client and closed the button case for good.
 *
 * ```tsx
 * <SettingsRail
 *   title={shop.name}
 *   subtitle={shop.slug}
 *   badge={<StoreIcon className="size-4.5" />}
 *   items={sections.map((s) => ({ id: s.id, label: t(s.id), icon: s.icon, active: s.id === current }))}
 *   renderItem={(item, props) => <Link href={hrefOf(item.id)} {...props} />}
 *   searchPlaceholder={t("searchNav")}
 *   emptyLabel={t("noNavMatch")}
 * />
 * ```
 *
 * The filter is the rail's own state, matched against each item's already
 * localized `label`. Both call sites render it from a layout rather than a
 * page, so switching section keeps whatever was typed.
 */
export function SettingsRail({
  title,
  subtitle,
  badge,
  items,
  renderItem,
  searchPlaceholder,
  searchLabel,
  emptyLabel,
  footer,
  className,
}: SettingsRailProps) {
  const [query, setQuery] = React.useState("")

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query])

  return (
    <aside className={cn("shrink-0 lg:sticky lg:top-0 lg:w-64", className)}>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center gap-3 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {badge}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 ps-8 text-sm"
              aria-label={searchLabel ?? searchPlaceholder}
            />
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-2 pt-0">
          {visible.map((item) => {
            const Icon = item.icon
            return (
              <React.Fragment key={item.id}>
                {renderItem(item, {
                  className: cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors",
                    item.active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ),
                  "aria-current": item.active ? "page" : undefined,
                  children: (
                    <>
                      {Icon ? <Icon className="size-4 shrink-0" /> : null}
                      <span className="truncate">{item.label}</span>
                    </>
                  ),
                })}
              </React.Fragment>
            )
          })}
          {visible.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : null}
        </nav>

        {footer ? (
          <div className="border-t border-border p-3">{footer}</div>
        ) : null}
      </div>
    </aside>
  )
}
