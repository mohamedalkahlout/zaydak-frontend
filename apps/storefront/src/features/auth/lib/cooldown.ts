"use client"

function cooldownStorageKey(key: string) {
  return `cooldown_until:${key}`
}

/** Persist a local resend cooldown so a remount does not invite a refused retry. */
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

const CODE_LENGTH_KEY = "sign_in_code_length"

/**
 * The length the last send announced. It is the platform's, not the number's
 * (the SMS provider's own length, or the OTP setting), so it is what a code
 * already in the customer's hand has — the one thing the cooldown answer
 * cannot say. A convenience only: every read and write may fail.
 */
export function rememberCodeLength(length: number) {
  try {
    window.localStorage.setItem(CODE_LENGTH_KEY, String(length))
  } catch {
    // Private mode or storage blocked: the fallback is the default length.
  }
}

/** What `rememberCodeLength` kept, or null when there is nothing usable. */
export function rememberedCodeLength(): number | null {
  try {
    const length = Number(window.localStorage.getItem(CODE_LENGTH_KEY))
    return Number.isInteger(length) && length >= 4 && length <= 10
      ? length
      : null
  } catch {
    return null
  }
}
