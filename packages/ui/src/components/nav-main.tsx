"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./sidebar"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

export interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  items?: { title: string; url: string }[]
}

/**
 * A labelled block of nav items.
 *
 * Distinct from `NavItem.items`, which nests links *under* a parent link as an
 * indented, icon-less sub-list. A group is a heading over siblings that each
 * keep their own icon and full weight — the right shape when the entries are
 * peers of one another rather than parts of one destination. Settings sections
 * are the case that needs it: SMS and Email are not children of "Settings", and
 * "Settings" is not somewhere you navigate to.
 */
export interface NavGroup {
  /** Already-localized. Omit for an unlabelled block, e.g. the top one. */
  label?: string
  items: NavItem[]
  /** Give the label a chevron that folds the group away. Ignored without a label. */
  collapsible?: boolean
}

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <SidebarGroup>
      <NavItems items={items} />
    </SidebarGroup>
  )
}

/**
 * Several labelled blocks, in order. An entry with no `label` renders as a bare
 * menu, so the common shape — a few top-level links, then one or more titled
 * sections — needs no wrapper at the call site.
 */
export function NavGroups({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group, index) => {
        if (!group.label) {
          return (
            <SidebarGroup key={`group-${index}`}>
              <NavItems items={group.items} />
            </SidebarGroup>
          )
        }

        if (!group.collapsible) {
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <NavItems items={group.items} />
            </SidebarGroup>
          )
        }

        // Open when the current route is inside the group, so a section never
        // hides the page you are on. Keyed on that so the default re-applies
        // when it flips, the same trick the nested collapsible below uses.
        const open = group.items.some((item) => isActive(pathname, item.url))
        return (
          <Collapsible
            key={`${group.label}:${open}`}
            defaultOpen={open}
            render={<SidebarGroup />}
          >
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="w-full cursor-pointer justify-between hover:text-sidebar-foreground"
            >
              <span>{group.label}</span>
              <ChevronDownIcon className="transition-transform duration-200 group-aria-expanded:rotate-180 aria-expanded:rotate-180" />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <NavItems items={group.items} />
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </>
  )
}

function NavItems({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <>
      <SidebarMenu>
        {items.map((item) => {
          const active = isActive(pathname, item.url, item.items)
          const hasSubItems = !!item.items?.length

          if (!hasSubItems) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              // Keying on `active` forces a fresh mount when active flips, so
              // `defaultOpen` is re-applied without the "uncontrolled changed"
              // warning from Base-UI.
              key={`${item.title}:${active}`}
              defaultOpen={active}
              render={<SidebarMenuItem />}
            >
              <SidebarMenuButton
                tooltip={item.title}
                isActive={active}
                render={<Link href={item.url} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                render={<CollapsibleTrigger />}
                // Collapsed, the chevron points the way the list reads — right
                // in LTR, left in RTL. Expanded it points down in both, so the
                // RTL flip has to be scoped to the collapsed state or the two
                // rotations compose into "up". `not-aria-expanded` and
                // `aria-expanded` cannot both match, so neither rule needs to
                // outrank the other.
                className="aria-expanded:rotate-90 rtl:not-aria-expanded:rotate-180"
              >
                <ChevronRightIcon />
                <span className="sr-only">Toggle</span>
              </SidebarMenuAction>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items!.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        isActive={pathname === subItem.url}
                        render={<Link href={subItem.url} />}
                      >
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </>
  )
}

function isActive(
  pathname: string | null,
  url: string,
  subItems?: { url: string }[],
): boolean {
  if (!pathname || url === "#") return false
  if (pathname === url || pathname.startsWith(`${url}/`)) return true
  return Boolean(subItems?.some((s) => s.url !== "#" && pathname.startsWith(s.url)))
}
