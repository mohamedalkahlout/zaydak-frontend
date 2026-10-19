"use client"

import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { SearchIcon } from "lucide-react"
import { LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { Input } from "@repo/ui/components/input"
import { SiteHeader as UiSiteHeader } from "@repo/ui/components/site-header"
import { ThemeToggleButton } from "@repo/ui/components/theme-toggle-button"

import { LocaleSwitcher } from "@/shared/components/locale-switcher"
import { forceLogout } from "@/shared/auth/session"
import { AppLogo } from "@/shared/components/app-logo"

interface SiteHeaderProps {
  user?: { name?: string; email?: string }
}

/**
 * The admin console's top bar. Same shell as the vendor dashboard, minus the
 * shop switcher, the AI toggle, and the contextual save bar — the console has no
 * staged-edit screens yet.
 */
export function SiteHeader({ user }: SiteHeaderProps = {}) {
  const t = useTranslations("header")

  const handleLogout = async () => {
    sileo.success({ title: t("loggedOut") })
    await forceLogout()
  }

  const displayName = user?.name || "Admin"
  const displayEmail = user?.email || ""
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "A"

  return (
    <UiSiteHeader
      logo={<AppLogo variant="responsive" size="md" href="/analytics" />}
      center={
        <div className="[grid-area:stack] relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white" />
          <Input
            type="search"
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10 w-full rounded-xl border-zinc-700 bg-[#282828] pl-9 text-sm text-white placeholder:text-white focus-visible:border-zinc-500 focus-visible:ring-zinc-500/30"
          />
        </div>
      }
      actions={<LocaleSwitcher className="text-white/70" />}
      userMenu={
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 ml-2 rounded-lg md:py-1 md:pl-1 md:pr-2 hover:bg-white/10 aria-expanded:bg-white/15 outline-none cursor-pointer">
            <Avatar size="default">
              <AvatarFallback className="rounded-lg! bg-green-600 text-white text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-sm font-medium text-white/90">
              {displayName}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={18} className="w-64 shadow-xl">
            <DropdownMenuItem className="flex items-center gap-3 py-2">
              <Avatar size="sm">
                <AvatarFallback className="bg-amber-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{displayName}</span>
                {displayEmail && (
                  <span className="text-xs text-muted-foreground">{displayEmail}</span>
                )}
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <div className="flex items-center justify-between gap-3 px-2 py-1.5">
              <span className="text-sm">{t("theme")}</span>
              <ThemeToggleButton variant="circle" start="top-right" className="size-7" />
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-3 py-2"
            >
              <LogOutIcon className="size-4 text-muted-foreground" />
              <span>{t("logOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )
}
