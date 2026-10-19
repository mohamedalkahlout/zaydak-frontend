"use client"

import { useEffect } from "react"

import { getCookie } from "@/shared/lib/cookies"
import { ACCESS_TOKEN_COOKIE } from "@/shared/auth/cookie-names"

/**
 * Kick a bfcache-restored page back to login when the session has since gone.
 *
 * Back-forward cache restores the rendered DOM without re-running anything, so
 * an authed screen can reappear minutes after logout with its data intact. The
 * reload is deliberately a full `location.href` rather than a router push —
 * the point is to discard that restored tree, which a client navigation keeps.
 *
 * Shared by every authed shell. It was inline in `DashboardShell` until the
 * integrations screen needed a shell without a sidebar; a second copy of an
 * auth check is exactly the kind of thing that gets fixed in one place only.
 */
export function useBfcacheAuthGuard(): void {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !getCookie(ACCESS_TOKEN_COOKIE)) {
        window.location.href = "/login"
      }
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])
}
