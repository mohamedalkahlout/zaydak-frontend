const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

interface CookieOptions {
  maxAge?: number
  path?: string
  secure?: boolean
  sameSite?: "strict" | "lax" | "none"
}

export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const {
    maxAge = DEFAULT_MAX_AGE,
    path = "/",
    secure = process.env.NODE_ENV === "production",
    sameSite = "lax",
  } = options

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `path=${path}`,
    `max-age=${maxAge}`,
    `SameSite=${sameSite}`,
  ]

  if (secure) parts.push("Secure")

  document.cookie = parts.join("; ")
}

/** Read a non-httpOnly cookie from the browser. Returns null on the server. */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

export function removeCookie(name: string, path = "/") {
  document.cookie = `${name}=; path=${path}; max-age=0`
}
