"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { arrivalRedirect } from "@/features/auth/lib/arrival-redirect"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { useShopTenant } from "@/shared/lib/use-shop-slug"

/**
 * A client-side visit to `/login` or `/register`.
 *
 * The standalone pages stay for a cold load (the route guard, an emailed
 * link). Arriving from another page of the shop opens the sign-in popup
 * over that page and goes back to it. Signing up is the same phone step
 * as signing in, so both routes open the one panel.
 */
export function InAppAuthArrival() {
  const router = useRouter()
  const open = useAuthDialogStore((s) => s.open)
  const { base } = useShopTenant()
  const arrived = useRef(false)

  useEffect(() => {
    // Development runs the effect twice. A second back() would leave the shop.
    if (arrived.current) return
    arrived.current = true
    const here = `${window.location.pathname}${window.location.search}`
    const previous = arrivalRedirect(document.referrer, window.location.origin, here)
    const home = base ? `${base}/` : "/"
    open("login", previous ?? home)
    if (window.history.length > 1) router.back()
  }, [base, open, router])

  return null
}
