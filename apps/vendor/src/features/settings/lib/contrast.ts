/** `#RGB` or `#RRGGBB`, matching the server's `@Matches(/^#[0-9a-fA-F]{6}$/)` on the long form. */
const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Normalise user input to the `#RRGGBB` the back-end accepts, or null. */
export function normalizeHex(raw: string): string | null {
  const value = raw.trim()
  const match = HEX.exec(value)
  if (!match) return null
  const digits = match[1]!
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits
  return `#${full.toLowerCase()}`
}

function channels(hex: string): [number, number, number] | null {
  const full = normalizeHex(hex)
  if (!full) return null
  return [
    parseInt(full.slice(1, 3), 16),
    parseInt(full.slice(3, 5), 16),
    parseInt(full.slice(5, 7), 16),
  ]
}

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/**
 * WCAG contrast ratio between two hex colours, 1 to 21, or null if either
 * side is not a colour yet.
 *
 * This is why a brand colour is stored as a *pair*. A background chosen alone
 * says nothing about whether anything can be read on it, and the pane is the
 * only place the two are ever seen together — so it is the only place that can
 * warn before white lands on white.
 */
export function contrastRatio(a: string, b: string): number | null {
  const ca = channels(a)
  const cb = channels(b)
  if (!ca || !cb) return null
  const la = luminance(ca)
  const lb = luminance(cb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** WCAG AA for body text. Below this the pane shows a warning, never a block. */
export const AA_CONTRAST = 4.5
