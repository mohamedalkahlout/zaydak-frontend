"use client"

import { shopPathFor } from "@/shared/lib/shop-scope"
import { useAuthStore } from "@/shared/stores/auth"

/** Sign out of one shop. The visitor stays signed in at every other storefront. */
export async function clearAuthSession(slug: string) {
  await fetch(`/api/auth/session?shop=${encodeURIComponent(slug)}`, {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => {})

  useAuthStore.getState().clearTokens(slug)
}

/**
 * Sign out of every shop in **this browser**.
 *
 * Named for what it actually does: it clears this browser's jar and revokes
 * each shop's refresh token, which does not reach the shopper's other devices.
 */
export async function clearAllAuthSessions() {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => {})

  useAuthStore.getState().clearAllSessions()
}

/**
 * Sign out and go somewhere sensible.
 *
 * The default is the *shop's* home rather than a sign-in screen: a customer who
 * signs out is still shopping, and their anonymous cart survives (it moves back
 * onto the `session_id` cookie). Dumping them on a login form would read as
 * being thrown out of the store.
 *
 * The slug is an argument rather than being re-read from `currentShopSlug()`:
 * the caller — the Apollo error link — knows which shop the failing operation
 * belonged to, and by the time this runs the URL may already have moved.
 */
export async function forceLogout(slug: string | null, redirectTo?: string) {
  if (slug) await clearAuthSession(slug)
  if (typeof window === "undefined") return
  window.location.href = redirectTo ?? shopPathFor(slug)
}
