"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"

import { SiteHeader } from "@/shared/components/site-header"
import { useBfcacheAuthGuard } from "@/shared/auth/use-bfcache-guard"

/**
 * Where closing lands. `app/page.tsx` redirects `/` here, so pushing `/users`
 * directly avoids a server round trip to be told the same thing.
 */
const HOME = "/users"

/**
 * A full-width shell with **no app sidebar** — the shape the vendor dashboard's
 * settings overlay uses, and now the integrations screen.
 *
 * The sidebar goes because the screen already carries its own left rail: two
 * nav columns side by side is two answers to "where am I". What replaces it is
 * the close affordance — an X and the Escape key, both landing on the console's
 * home, so a screen with no sidebar is never a screen with no way out.
 *
 * The header stays. It holds the account menu and the locale switch, and it is
 * the one piece of chrome that is not navigation.
 */
export function SettingsShell({
  user,
  children,
}: {
  user?: { name?: string; email?: string }
  children: React.ReactNode
}) {
  useBfcacheAuthGuard()
  const router = useRouter()
  const t = useTranslations("integrations")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only when nothing is layered above: a dialog's own Escape has to close
      // the dialog, not throw the admin out of the screen behind it.
      if (e.key !== "Escape") return
      if (document.querySelector("[data-slot=dialog-content]")) return
      router.push(HOME)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  return (
    // `h-svh` pins the shell to the viewport and the body scrolls inside it, so
    // the header stays parked — same as `DashboardShell`.
    <div className="flex h-svh flex-col bg-black [--header-height:calc(--spacing(16))]">
      <SiteHeader user={user} />
      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-t-2xl bg-background">
        <button
          type="button"
          onClick={() => router.push(HOME)}
          aria-label={t("close")}
          className="absolute end-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <XIcon className="size-5" />
        </button>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
