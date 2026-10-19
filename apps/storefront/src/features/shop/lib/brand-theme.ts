import type { ShellColorPair, ShopShellData } from "./shop-server"

/**
 * Turn a shop's two brand colour pairs into an override of the storefront's own
 * accent tokens.
 *
 * The app is re-skinned by redefining `@repo/ui`'s tokens in `globals.css`, and
 * this is the same trick one level down: only the *accent* pair moves, so a
 * shop recolours its buy buttons, badges and footer flourish without touching
 * the paper ground, the ink or any state colour. A vendor cannot make their own
 * "out of stock" green or turn the page black — those carry meaning that is not
 * theirs to redefine.
 *
 * `--shop-accent-soft` is derived rather than taken, because it only ever
 * existed as a wash of the accent. Deriving it with `color-mix` also fixes a
 * latent bug in the fixed palette: the light and dark values were two
 * hand-written colours that would have drifted from an overridden accent.
 */

/** Mirrors the back-end's `@Matches(/^#[0-9a-fA-F]{6}$/)` — anything else is ignored. */
const HEX = /^#[0-9a-fA-F]{6}$/

function hex(value?: string | null): string | null {
  const v = value?.trim().toLowerCase()
  return v && HEX.test(v) ? v : null
}

function pair(p?: ShellColorPair | null) {
  return { background: hex(p?.background), foreground: hex(p?.foreground) }
}

/**
 * The CSS text to drop in a `<style>` above the shell, or `""` when the shop
 * has set no colours — in which case nothing is emitted at all and the default
 * palette applies untouched.
 *
 * Scoped to `:root` because the tokens are consumed through Tailwind utilities
 * (`bg-shop-accent`) all over the tree, including inside portals — a wrapper
 * element would leave the cart drawer and every dialog on the old accent.
 */
export function brandThemeCss(shop: ShopShellData | null): string {
  const colors = shop?.settings?.brand?.colors
  if (!colors) return ""

  const primary = pair(colors.primary)
  const secondary = pair(colors.secondary)

  const declarations: string[] = []

  if (primary.background) {
    declarations.push(`--shop-accent:${primary.background}`)
    declarations.push(
      `--shop-accent-soft:color-mix(in srgb, ${primary.background} 14%, transparent)`,
    )
  }
  if (primary.foreground) {
    declarations.push(`--shop-accent-foreground:${primary.foreground}`)
  }
  // The footer falls back to the primary pair, because a shop that published
  // one brand colour has published its brand: leaving the footer on the
  // default ink made a red storefront end in a slab that belonged to nobody,
  // and the vendor reads that as the theme not reaching the footer at all.
  // The pair stays together — an explicit secondary ink survives, but a
  // secondary background is never paired with a primary foreground it was
  // never checked for contrast against.
  const footer = secondary.background
    ? secondary
    : {
        background: primary.background,
        foreground: secondary.foreground ?? primary.foreground,
      }

  if (footer.background) {
    declarations.push(`--shop-footer-accent:${footer.background}`)
    // The payment-method chips. A wash rather than the accent itself: they are
    // six quiet labels at the foot of the page, and painted in the accent they
    // would read as six buttons. Derived for the same reason
    // `--shop-accent-soft` is — a fixed tint would drift from an overridden
    // accent, which is exactly how these ended up mint under a red shop.
    //
    // Mixed with `transparent`, not with the footer ground: this override sits
    // on `:root` and therefore applies in dark mode too, where a wash built on
    // white would be a pale chip on a near-black slab. A translucent tint
    // composites over whichever ground is under it and is right in both.
    declarations.push(
      `--shop-footer-field:color-mix(in srgb, ${footer.background} 12%, transparent)`,
    )
  }
  if (footer.foreground) {
    declarations.push(`--shop-footer-accent-ink:${footer.foreground}`)
  }

  if (declarations.length === 0) return ""
  return `:root{${declarations.join(";")};}`
}
