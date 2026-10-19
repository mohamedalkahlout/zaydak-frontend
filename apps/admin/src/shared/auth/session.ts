"use client"

import { useAuthStore } from "@/shared/stores/auth"

export async function clearAuthSession() {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => {})

  useAuthStore.getState().clearTokens()
}

export async function forceLogout(redirectTo = "/login") {
  await clearAuthSession()
  if (typeof window !== "undefined") window.location.href = redirectTo
}
