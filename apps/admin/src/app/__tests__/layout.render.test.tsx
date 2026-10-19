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
 * (No jest-dom in this project — assertions use plain DOM/element properties.)
 */

const TAJAWAL_CLASS = "__tajawal_variable_test"

// The real `server-only` package is a guard whose whole implementation is a
// throw on import, so anything reached from a Server Component's import graph
// is unloadable here. Empty is right: the guard has nothing to assert.
vi.mock("server-only", () => ({}))

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
}))

const { Tajawal } = await import("next/font/google")
const RootLayout = (await import("../layout")).default

describe("admin root layout", () => {
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
})
