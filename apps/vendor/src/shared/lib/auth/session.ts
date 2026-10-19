"use client"

import { sileo } from "sileo"
import { useAuthStore } from "@/shared/stores/auth"
import { clearApolloCache } from "./apollo-bridge"

interface ForceLogoutOptions {
  title?: string
  description?: string
  redirectTo?: string
}

export async function clearAuthSession() {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => {})

  // Order matters: drop in-memory tokens first so any in-flight render can't
  // re-issue authenticated queries, then nuke the Apollo cache to evict any
  // data tied to the previous user.
  useAuthStore.getState().clearTokens()
  await clearApolloCache()
}

export async function forceLogout(options: ForceLogoutOptions = {}) {
  await clearAuthSession()

  if (options.title) {
    sileo.error({
      title: options.title,
      description: options.description,
    })
  }

  if (typeof window !== "undefined") {
    window.location.href = options.redirectTo ?? "/login"
  }
}
