import { describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"

/**
 * Item 79's failure, pinned. Same test in all three apps, deliberately.
 *
 * Every app declares Tajawal with `next/font/google` and hangs its generated
 * class on `<html>`; `globals.css` reads `--font-tajawal` under
 * `html[lang="ar"]`. A merge once dropped one app's `const tajawal = ...`
 * while leaving the JSX that referenced it, and that root layout threw a
 * ReferenceError on module evaluation — every route down, from a diff that
 * read as a font swap. Nothing held the three declarations together.
 *
 * Shape of the test: the root layout is an async Server Component and cannot
 * go through `render()` here — `next/font/google` ships an empty stub outside
 * the Next build (the real loader is a webpack/turbopack plugin), and
 * `getLocale`/`getMessages` need a request context. So the layout is imported
 * (which is what catches the ReferenceError) and awaited as the function it
 * is, and the returned `<html>` element is asserted on directly. Only the
 * build-time-only modules are mocked; the font call itself is real and its
 * arguments are checked, so removing or re-tuning the declaration fails here.
 *
 * (`server-only` needs no mock here — this app already aliases it to a stub in
 * `vitest.config.ts`.)
 *
 * (No jest-dom in this project — assertions use plain DOM/element properties.)
 */

const TAJAWAL_CLASS = "__tajawal_variable_test"

vi.mock("next/font/google", () => ({
  // `variable` is the generated class name next/font hands back, not the
  // custom property; a sentinel makes it visible on the element below.
  Tajawal: vi.fn(() => ({ variable: TAJAWAL_CLASS })),
  Geist_Mono: vi.fn(() => ({ variable: "__geist_mono_variable_test" })),
}))

// The Apollo module reaches the RSC client through the `react-server` export
// condition, which is absent here. The provider is not what this test is about.
vi.mock("@/shared/apollo/client", () => ({
  ApolloProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "ar"),
  getMessages: vi.fn(async () => ({})),
  getTranslations: vi.fn(async () => (key: string) => key),
}))

// The headers `proxy.ts` stamps on the request, swapped per test.
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.current),
}))

const { Tajawal } = await import("next/font/google")
const RootLayout = (await import("../layout")).default

describe("storefront root layout", () => {
  it("declares Tajawal as the --font-tajawal variable font", () => {
    expect(Tajawal).toHaveBeenCalledWith(
      expect.objectContaining({
        variable: "--font-tajawal",
        subsets: expect.arrayContaining(["arabic"]),
        // Tajawal has no 600; `font-semibold` resolves up to the real bold.
        weight: ["300", "400", "500", "700"],
      }),
    )
  })

  it("puts the Tajawal variable class on <html>", async () => {
    const tree = (await RootLayout({ children: null })) as ReactElement<{
      className?: string
      lang?: string
    }>

    expect(tree.type).toBe("html")
    expect(tree.props.lang).toBe("ar")
    expect(tree.props.className?.split(/\s+/)).toContain(TAJAWAL_CLASS)
  })

  describe("the host shop on <html>", () => {
    // The browser cannot tell which shop a merchant's own domain serves — the
    // hostname names none — so the root layout hands over the proxy's answer.
    // Without it every client query on a custom domain went out with no
    // `X-SHOP` and was refused MISSING_SHOP_HEADER.
    type HtmlProps = Record<string, unknown>

    it("names the shop a host-mode request was resolved to", async () => {
      requestHeaders.current = new Headers({
        "x-storefront-tenant-mode": "host",
        "x-storefront-tenant-slug": "nike",
      })

      const tree = (await RootLayout({ children: null })) as ReactElement<HtmlProps>

      expect(tree.props["data-host-shop"]).toBe("nike")
    })

    it("renders nothing in path mode, where the path already names the shop", async () => {
      requestHeaders.current = new Headers({
        "x-storefront-tenant-mode": "path",
        // Not something the proxy would pass through; ignored without host mode.
        "x-storefront-tenant-slug": "nike",
      })

      const tree = (await RootLayout({ children: null })) as ReactElement<HtmlProps>

      expect(tree.props).not.toHaveProperty("data-host-shop")
    })
  })
})
