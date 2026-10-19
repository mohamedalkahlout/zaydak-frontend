import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { SiteHeader } from "../site-header"
import { SidebarProvider } from "../sidebar"

/**
 * `SiteHeader` must render with or without a sidebar above it.
 *
 * This is a regression test with a specific history: the admin console's
 * integrations screen dropped the sidebar (it carries its own left rail), and
 * the header's `useSidebar()` threw on every request to it. **`next build`
 * passed** — the route is dynamic, so nothing rendered it until a real request
 * arrived, and the whole page 500'd in production while every local check was
 * green. A render test is the cheapest thing that would have caught it.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("SiteHeader", () => {
  beforeAll(() => {
    // jsdom ships no `matchMedia`, and `SidebarProvider` reaches for it through
    // `useIsMobile`. Only the provider case needs it — the header itself never
    // touches it, which is part of why it can stand without one.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
  })

  it("renders without a SidebarProvider, and offers no toggle", () => {
    render(<SiteHeader logo={<span>Zaydak</span>} />)

    expect(screen.getByText("Zaydak")).toBeTruthy()
    // Nothing to toggle means no toggle: a button that moves nothing is worse
    // than its absence.
    expect(screen.queryByLabelText("Toggle sidebar")).toBeNull()
  })

  it("offers the toggle when there is a sidebar to toggle", () => {
    render(
      <SidebarProvider>
        <SiteHeader logo={<span>Zaydak</span>} />
      </SidebarProvider>,
    )

    expect(screen.getByLabelText("Toggle sidebar")).toBeTruthy()
  })

  it("renders its slots either way", () => {
    render(
      <SiteHeader
        logo={<span>Zaydak</span>}
        center={<span data-testid="center">search</span>}
        actions={<span>actions</span>}
        userMenu={<span>account</span>}
      />,
    )

    expect(screen.getByTestId("center")).toBeTruthy()
    expect(screen.getByText("actions")).toBeTruthy()
    expect(screen.getByText("account")).toBeTruthy()
  })
})
