/**
 * Where to send an admin user after they sign in.
 *
 * The `?redirect=` parameter is attacker-controllable — it is written by the
 * route guard but nothing stops someone handing out a link with their own
 * value. Only same-origin relative paths are honoured.
 *
 * Rejects protocol-relative URLs (`//evil.example`), backslash tricks (`/\evil.example`),
 * full external URLs (`https://evil.example`), or protocol schemes (`javascript:`, `data:`).
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("://") || raw.includes("\r") || raw.includes("\n")) return fallback;
  return raw;
}
