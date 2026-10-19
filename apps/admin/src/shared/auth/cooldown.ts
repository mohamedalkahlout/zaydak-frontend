"use client"

function cooldownStorageKey(key: string) {
  return `cooldown_until:${key}`
}

export function startCooldown(key: string, seconds: number) {
  if (typeof window === "undefined") return
  const endAt = Date.now() + seconds * 1000
  window.localStorage.setItem(cooldownStorageKey(key), String(endAt))
}

export function getRemainingCooldownSeconds(key: string) {
  if (typeof window === "undefined") return 0
  const raw = window.localStorage.getItem(cooldownStorageKey(key))
  const until = Number(raw ?? 0)
  if (!until) return 0

  const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
  if (remaining === 0) {
    window.localStorage.removeItem(cooldownStorageKey(key))
  }
  return remaining
}
