import { describe, it, expect } from "vitest"
import { shareTargets } from "../share-targets"

// The share links are strings a vendor pastes nowhere and never sees, so a
// broken one is only found when a customer lands on half a URL. What is worth
// pinning is the encoding: a title with `&` or `#` must survive the query
// string, and each network must get the URL where it actually reads it.

const URL = "https://shop.test/acme/products/mug"
const TITLE = "Mug & Saucer #1"

describe("shareTargets", () => {
  it("encodes the title and URL into every target", () => {
    for (const target of shareTargets(TITLE, URL)) {
      expect(target.href).not.toContain("&Saucer")
      expect(target.href).not.toContain("#1")
      expect(target.href).toContain(encodeURIComponent(URL))
    }
  })

  it("puts title and URL together in WhatsApp's single text parameter", () => {
    const whatsapp = shareTargets(TITLE, URL).find((t) => t.id === "whatsapp")!
    expect(whatsapp.href).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${TITLE} ${URL}`)}`,
    )
  })

  it("gives X a url and a text, and Facebook the url alone", () => {
    const targets = shareTargets(TITLE, URL)
    expect(targets.find((t) => t.id === "x")!.href).toBe(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(URL)}&text=${encodeURIComponent(TITLE)}`,
    )
    expect(targets.find((t) => t.id === "facebook")!.href).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`,
    )
  })

  it("sends email as subject and body, in the current tab", () => {
    const email = shareTargets(TITLE, URL).find((t) => t.id === "email")!
    expect(email.href).toBe(
      `mailto:?subject=${encodeURIComponent(TITLE)}&body=${encodeURIComponent(URL)}`,
    )
    expect(email.newTab).toBe(false)
    expect(
      shareTargets(TITLE, URL)
        .filter((t) => t.id !== "email")
        .every((t) => t.newTab),
    ).toBe(true)
  })
})
