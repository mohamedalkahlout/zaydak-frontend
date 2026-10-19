"use client"

import * as React from "react"

import { NavGroups, NavMain, type NavGroup, type NavItem } from "./nav-main"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "./sidebar"

export type { NavGroup, NavItem }

export interface AppSidebarProps
  extends Omit<React.ComponentProps<typeof Sidebar>, "children"> {
  /** A single flat list. Ignored when `groups` is given. */
  items?: NavItem[]
  /**
   * Labelled blocks, in order. Use this when the nav has sections — an app with
   * a Settings area needs a heading over peers, which `items` cannot express.
   */
  groups?: NavGroup[]
  /** Top of the sidebar (e.g. mobile drawer logo). */
  header?: React.ReactNode
  /** Pinned to the bottom of the scrollable content — e.g. a Settings link. */
  bottom?: React.ReactNode
  /** Fixed below the content — e.g. a subscription CTA. */
  footer?: React.ReactNode
}

/**
 * The dashboard sidebar, shared by every app.
 *
 * Presentational only: it reads no store and knows no routes. Callers pass the
 * already-localized items and decide `side` (which is `"right"` under RTL).
 */
export function AppSidebar({
  items,
  groups,
  header,
  bottom,
  footer,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]! rounded-ss-2xl overflow-hidden"
      {...props}
    >
      {header ? <SidebarHeader className="p-2">{header}</SidebarHeader> : null}
      <SidebarContent className={header ? "pt-1" : "pt-4"}>
        {groups ? <NavGroups groups={groups} /> : <NavMain items={items ?? []} />}
        {bottom}
      </SidebarContent>
      {footer ? <SidebarFooter className="p-3">{footer}</SidebarFooter> : null}
    </Sidebar>
  )
}
