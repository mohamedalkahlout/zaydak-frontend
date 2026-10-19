import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

/**
 * The `/contact` route body.
 *
 * What is worth pinning here is **not** the copy — it is that every link is
 * built from `base` rather than from the slug. `base` is `/acme` on the apex
 * and the **empty string** on `acme.zaydak.com`, so a `` `/${slug}/contact` ``
 * literal is correct on one address and, on the other, navigates to
 * `acme.zaydak.com/acme/…`, which the proxy rewrites to `/acme/acme/…` and
 * 404s. Nothing about that failure is visible on the apex, which is where it
 * would be developed and reviewed.
 */

const shopState = vi.hoisted(() => ({
  slug: "acme",
  base: "/acme",
  mode: "path" as "path" | "host",
  shop: null as Record<string, unknown> | null,
  missing: false,
  currency: "USD",
}))

vi.mock("@/features/shop/shop-context", () => ({ useShop: () => shopState }))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${Object.values(vars).join(",")}` : key,
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

const { ContactPage } = await import("../contact-page")

function renderPage(
  scope: { base: string; mode: "path" | "host" },
  shop: Record<string, unknown> | null = { name: "Acme Supply" },
) {
  shopState.base = scope.base
  shopState.mode = scope.mode
  shopState.shop = shop
  return render(<ContactPage />)
}

beforeEach(() => {
  shopState.base = "/acme"
  shopState.mode = "path"
  shopState.shop = { name: "Acme Supply" }
})

describe("ContactPage links", () => {
  it("prefixes the shop home with base on the apex", () => {
    renderPage({ base: "/acme", mode: "path" })
    expect(
      screen.getByRole("link", { name: "Acme Supply" }).getAttribute("href"),
    ).toBe("/acme")
  })

  it("carries no slug segment on the shop's own hostname", () => {
    const { container } = renderPage({ base: "", mode: "host" })

    // `${base}/` with an empty base is "/", which `next/link` keeps. A
    // `/${slug}/` literal would be "/acme/" here — the bug this pins.
    expect(
      screen.getByRole("link", { name: "Acme Supply" }).getAttribute("href"),
    ).toBe("/")

    const hrefs = [...container.querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href"),
    )
    expect(hrefs.some((href) => href?.startsWith("/acme"))).toBe(false)
  })
})

describe("ContactPage published details", () => {
  it("dials the phone and mails the address, which are two different fields", () => {
    // `settings.contact` is the phone number and `settings.email` is the
    // address. The footer used to `mailto:` the phone, composing a message to
    // an address that could not exist — `features/shop/lib/contact.ts` records
    // it, and this pins each to its own scheme on the screen that exists to
    // list ways of reaching a shop.
    const { container } = renderPage({ base: "/acme", mode: "path" }, {
      name: "Acme Supply",
      settings: { contact: "+1 855-987-4420", email: "hello@acme.test" },
    })

    expect(container.querySelector('a[href^="tel:"]')?.getAttribute("href")).toBe(
      "tel:+18559874420",
    )
    expect(
      container.querySelector('a[href^="mailto:"]')?.getAttribute("href"),
    ).toBe("mailto:hello@acme.test")
  })

  it("renders the form for a shop that published nothing to be reached by", () => {
    // The aside is optional; the form is not. A shop with no phone and no
    // published address is exactly the one this page exists for.
    const { container } = renderPage({ base: "/acme", mode: "path" }, {
      name: "Acme Supply",
    })

    expect(container.querySelector("form")).toBeTruthy()
    expect(container.querySelector('a[href^="tel:"]')).toBeNull()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})
