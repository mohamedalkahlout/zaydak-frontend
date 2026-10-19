/**
 * Free ngrok serves an HTML interstitial to anything that looks like a
 * browser unless this header is present. Vercel preview traffic is HTTPS
 * and often carries a browser-like User-Agent, so GraphQL, RSC preloads
 * and the auth refresh route all have to send it — otherwise a shop page
 * parses a warning page as an empty catalogue.
 *
 * Harmless on any other host: callers can spread the result unconditionally.
 */
const TUNNEL_HOST_SUFFIXES = [
  ".ngrok-free.app",
  ".ngrok.app",
  ".ngrok.io",
  ".ngrok-free.dev",
] as const

const SKIP_HEADER = "ngrok-skip-browser-warning"

export function tunnelHeaders(
  url: string = process.env.NEXT_PUBLIC_GRAPHQL_URL ||
    "http://localhost:3000/graphql",
): Record<string, string> {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return {}
  }
  const isTunnel = TUNNEL_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
  )
  return isTunnel ? { [SKIP_HEADER]: "1" } : {}
}
