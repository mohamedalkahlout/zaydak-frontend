import { describe, expect, it } from "vitest"
import { platformRootFrom, viewUrlFor } from "../domain-urls"

/**
 * The "View" link on each row of the domains table.
 *
 * The rule these pin is that **the server's row is the address**. A custom
 * domain is its own hostname; the platform row is synthesised by the back-end
 * from its own apex and omitted when it has none, so its presence and its
 * hostname are together the whole answer. This app used to re-derive it from
 * `NEXT_PUBLIC_ROOT_DOMAIN` — a second copy of the same fact, set on a
 * different deployment by a different person — and with that variable unset
 * against a back-end that had an apex, the table listed `acme.zaydak.com` while
 * its own View link opened `localhost:3003/acme`.
 */
describe("viewUrlFor", () => {
  const custom = { kind: "CUSTOM" as const, hostname: "shop.example.com" }
  const platform = { kind: "PLATFORM_SUBDOMAIN" as const, hostname: "acme.zaydak.com" }
  const env = { storefrontUrl: "http://localhost:3003", rootDomain: null }

  it("opens a custom domain at its own hostname, over https", () => {
    expect(viewUrlFor(custom, "acme", env)).toBe("https://shop.example.com")
  })

  it("opens the platform row at the hostname the server listed", () => {
    expect(
      viewUrlFor(platform, "acme", {
        storefrontUrl: "https://zaydak.com",
        rootDomain: "zaydak.com",
      }),
    ).toBe("https://acme.zaydak.com")
  })

  it("still opens it there when this app has no apex configured of its own", () => {
    // The case that was broken. A platform row only exists when the *back-end*
    // has an apex, so the row is proof of host mode — and consulting this app's
    // own environment could only ever contradict it.
    expect(viewUrlFor(platform, "acme", env)).toBe("https://acme.zaydak.com")
  })

  it("falls back to the path-scoped storefront when there is no row to read", () => {
    // The list has not answered, or the deployment is path-scoped and the
    // server sent no platform row. Both serve: the apex never redirects.
    expect(
      viewUrlFor({ kind: "PLATFORM_SUBDOMAIN", hostname: null }, "acme", env),
    ).toBe("http://localhost:3003/acme")
  })

  it("does not double a trailing slash on the storefront URL", () => {
    expect(
      viewUrlFor({ kind: "PLATFORM_SUBDOMAIN" }, "acme", {
        storefrontUrl: "http://localhost:3003/",
        rootDomain: null,
      }),
    ).toBe("http://localhost:3003/acme")
  })
})

/**
 * The apex, read back out of the address the server actually listed.
 *
 * Everything else on the screen that names one — the banner, the
 * change-address card, its illustration, the handle preview inside the dialog
 * — reads it from here, so none of them can name an apex the table does not.
 */
describe("platformRootFrom", () => {
  const platform = (hostname: string | null) => [
    { kind: "PLATFORM_SUBDOMAIN" as const, hostname },
    { kind: "CUSTOM" as const, hostname: "acme.com" },
  ]

  it("reads the apex out of the synthesised hostname", () => {
    expect(platformRootFrom(platform("acme.zaydak.com"), "acme")).toBe(
      "zaydak.com",
    )
  })

  it("handles an apex with more than two labels", () => {
    expect(platformRootFrom(platform("acme.shops.zaydak.co.uk"), "acme")).toBe(
      "shops.zaydak.co.uk",
    )
  })

  it("is null when the server sent no platform row at all", () => {
    // Path-scoped, and a state rather than a missing value: the deployment has
    // no apex, and every caller already renders that case.
    expect(
      platformRootFrom([{ kind: "CUSTOM", hostname: "acme.com" }], "acme"),
    ).toBeNull()
  })

  it("refuses a hostname that is not this shop's own address", () => {
    // Nothing should reach here, and if something does, answering "zaydak.com"
    // for a row belonging to another handle would be a confident wrong answer
    // where null is a correct one.
    expect(platformRootFrom(platform("other.zaydak.com"), "acme")).toBeNull()
  })
})
