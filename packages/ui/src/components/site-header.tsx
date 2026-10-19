"use client"

import * as React from "react"

import { Button } from "./button"
import { SidebarToggleIcon } from "./sidebar-toggle-icon"
import { useSidebarOptional } from "./sidebar"

export interface SiteHeaderProps {
  logo: React.ReactNode
  /**
   * Center region. Rendered inside a `[grid-template-areas:'stack']` container,
   * so several children (a search box and a save bar, say) can occupy the same
   * cell and cross-fade. Each child must declare `[grid-area:stack]`.
   */
  center?: React.ReactNode
  /** Icon buttons shown before the account menu. */
  actions?: React.ReactNode
  /** The avatar / account dropdown. */
  userMenu?: React.ReactNode
  toggleLabel?: string
}

/**
 * The top bar, shared by every app. Presentational: the only behaviour it owns
 * is the mobile sidebar toggle.
 *
 * **It does not require a `SidebarProvider`.** The toggle appears only when
 * there is a sidebar above it to toggle, so the same header serves a screen
 * that deliberately has none (the admin console's integrations screen, which
 * carries its own left rail instead). Rendering a toggle there would be a
 * button that moves nothing; throwing, as `useSidebar` does, would be refusing
 * to draw a header over a missing feature it does not actually need.
 */
export function SiteHeader({
  logo,
  center,
  actions,
  userMenu,
  toggleLabel = "Toggle sidebar",
}: SiteHeaderProps) {
  const sidebar = useSidebarOptional()

  return (
    <header className="z-30 flex h-(--header-height) w-full min-w-0 shrink-0 items-center justify-between px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {sidebar ? (
          <Button
            className="h-8 w-8 md:hidden"
            variant="ghost"
            size="icon"
            onClick={sidebar.toggleSidebar}
            aria-label={toggleLabel}
          >
            <SidebarToggleIcon isOpen={sidebar.open} />
          </Button>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">{logo}</div>
      </div>

      {center ? (
        <div className="hidden min-w-0 w-full max-w-2xl sm:grid px-4 [grid-template-areas:'stack']">
          {center}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {actions}
        {userMenu}
      </div>
    </header>
  )
}
