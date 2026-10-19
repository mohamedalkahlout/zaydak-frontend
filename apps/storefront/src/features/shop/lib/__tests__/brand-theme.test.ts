import { describe, expect, it } from "vitest"
import { brandThemeCss } from "../brand-theme"
import { socialLabel } from "../socials"
import type { ShopShellData } from "../shop-server"

type Brand = NonNullable<NonNullable<ShopShellData["settings"]>["brand"]>

function shop(brand: Brand): ShopShellData {
  return { id: "s1", name: "Acme", slug: "acme", settings: { brand } }
}

describe("brandThemeCss", () => {
  it("emits nothing when the shop set no colours", () => {
    expect(brandThemeCss(null)).toBe("")
    expect(brandThemeCss({ id: "s1", name: "Acme", slug: "acme" })).toBe("")
    expect(brandThemeCss(shop({ colors: null }))).toBe("")
  })

  it("maps the primary pair onto the accent tokens and derives the wash", () => {
    const css = brandThemeCss(
      shop({ colors: { primary: { background: "#123456", foreground: "#ffffff" } } }),
    )
    expect(css).toContain("--shop-accent:#123456")
    expect(css).toContain("--shop-accent-foreground:#ffffff")
    // Derived, not taken — the fixed light/dark pair would have drifted from
    // an overridden accent.
    expect(css).toContain(
      "--shop-accent-soft:color-mix(in srgb, #123456 14%, transparent)",
    )
  })

  it("maps the secondary pair onto the footer accent", () => {
    const css = brandThemeCss(
      shop({ colors: { secondary: { background: "#abcdef", foreground: "#000000" } } }),
    )
    expect(css).toContain("--shop-footer-accent:#abcdef")
    expect(css).toContain("--shop-footer-accent-ink:#000000")
    expect(css).not.toContain("--shop-accent:")
  })

  it("falls the footer back to the primary pair when there is no secondary", () => {
    // A shop that published one colour has published its brand. Without this
    // the footer stayed on the default ink and the theme visibly stopped at
    // the bottom of the page.
    const css = brandThemeCss(
      shop({ colors: { primary: { background: "#ff0000", foreground: "#000000" } } }),
    )
    expect(css).toContain("--shop-footer-accent:#ff0000")
    expect(css).toContain("--shop-footer-accent-ink:#000000")
  })

  it("derives the payment-chip wash from the footer accent", () => {
    const css = brandThemeCss(
      shop({ colors: { primary: { background: "#ff0000" } } }),
    )
    // `transparent`, not the footer ground: the override lands on `:root` and
    // applies in dark mode too.
    expect(css).toContain(
      "--shop-footer-field:color-mix(in srgb, #ff0000 12%, transparent)",
    )
  })

  it("keeps a secondary background paired with its own ink, never the primary's", () => {
    const css = brandThemeCss(
      shop({
        colors: {
          primary: { background: "#ff0000", foreground: "#ffffff" },
          secondary: { background: "#abcdef" },
        },
      }),
    )
    expect(css).toContain("--shop-footer-accent:#abcdef")
    // #ffffff was checked against #ff0000, not against #abcdef.
    expect(css).not.toContain("--shop-footer-accent-ink:")
  })

  it("keeps an explicit secondary ink when only the primary carries a background", () => {
    const css = brandThemeCss(
      shop({
        colors: {
          primary: { background: "#ff0000", foreground: "#ffffff" },
          secondary: { foreground: "#222222" },
        },
      }),
    )
    expect(css).toContain("--shop-footer-accent:#ff0000")
    expect(css).toContain("--shop-footer-accent-ink:#222222")
  })

  it("drops anything that is not six hex digits", () => {
    // The string goes into a <style> tag, so nothing that failed the
    // back-end's own #RRGGBB check may reach it.
    const css = brandThemeCss(
      shop({
        colors: {
          primary: { background: "red; } body { display:none } :root{", foreground: "#fff" },
        },
      }),
    )
    expect(css).toBe("")
  })

  it("touches only the accent tokens, never the ground or the state colours", () => {
    const css = brandThemeCss(
      shop({
        colors: {
          primary: { background: "#123456", foreground: "#ffffff" },
          secondary: { background: "#abcdef", foreground: "#000000" },
        },
      }),
    )
    for (const off_limits of [
      "--shop-sale",
      "--shop-in-stock",
      "--shop-out-of-stock",
      "--shop-hairline",
      "--shop-footer-ground",
      "--background",
    ]) {
      expect(css).not.toContain(off_limits)
    }
  })
})

describe("socialLabel", () => {
  it("gives a known key the name the network writes for itself", () => {
    expect(socialLabel("tiktok")).toBe("TikTok")
    expect(socialLabel("x")).toBe("X")
    expect(socialLabel("whatsapp")).toBe("WhatsApp")
  })

  it("matches regardless of case or padding", () => {
    expect(socialLabel(" Instagram ")).toBe("Instagram")
  })

  it("passes an unknown name through, so older rows still render", () => {
    expect(socialLabel("tumblr")).toBe("tumblr")
  })
})
