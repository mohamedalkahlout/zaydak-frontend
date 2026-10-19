import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { NotchNav, type NotchItemData } from "../notch-nav"

/**
 * The notch bar's two load-bearing properties, neither of which is visual.
 *
 * **One control, one place in the DOM.** The source component collapsed the
 * three slabs into a single island below `xl`, which meant rendering the action
 * controls a second time. That is not survivable here: `cart-flight.ts` locates
 * the bag by `[data-cart-anchor]` and would fly a product photo into whichever
 * copy `querySelector` reached first, and the rolling badge is a single
 * `NumberFlow` instance on purpose (`cart-badge.render.test.tsx`). So the slabs
 * stay apart at every width and only the *middle* one changes shape.
 *
 * **The panel is closed until it is opened.** It is always mounted — the
 * open/close is an opacity and scale transition, not a mount — so nothing but
 * `aria-hidden` and `pointer-events` stands between a screen reader and a menu
 * the shopper never opened.
 *
 * jsdom lays nothing out and applies no media queries, so `xl:hidden` is not
 * observable here at any price. What *is* observable is how many nodes exist,
 * which is exactly the question above.
 */

const items: NotchItemData[] = [
  { id: "home", label: "Home", href: "/acme" },
  { id: "products", label: "All products", href: "/acme/products" },
]

function renderNav(activeId = "home") {
  return render(
    <NotchNav
      items={items}
      activeId={activeId}
      label="Shop"
      menuLabel="Menu"
      logo={<span data-testid="brand">Acme</span>}
      rightContent={<button type="button" data-cart-anchor aria-label="Cart" />}
      drawer={<input aria-label="Search" />}
    />,
  )
}

afterEach(cleanup)

describe("the notch bar", () => {
  it("renders the brand and the action controls exactly once", () => {
    renderNav()

    expect(screen.getAllByTestId("brand")).toHaveLength(1)
    expect(document.querySelectorAll("[data-cart-anchor]")).toHaveLength(1)
  })

  it("keeps the dropdown panel hidden until the trigger is pressed", () => {
    renderNav()

    const panel = screen.getByRole("menu", { hidden: true })
    expect(panel.getAttribute("aria-hidden")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    expect(screen.getByRole("menu").getAttribute("aria-hidden")).toBeNull()
  })

  it("closes the panel on Escape", () => {
    renderNav()

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    expect(screen.getByRole("menu").getAttribute("aria-hidden")).toBeNull()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(
      screen.getByRole("menu", { hidden: true }).getAttribute("aria-hidden"),
    ).toBe("true")
  })

  it("marks the active entry, and exposes the panel's copy only once it is open", () => {
    renderNav("products")

    // The entries are the one thing deliberately rendered twice — the panel
    // *is* the menu at small widths — so while it is closed only the slab's
    // copy is in the accessibility tree.
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))

    const current = screen.getAllByRole("link", { current: "page" })
    expect(current).toHaveLength(2)
    expect(current.every((el) => el.textContent === "All products")).toBe(true)
  })

  it("keeps the outline overlay out of the way of every control", () => {
    const { container } = renderNav()

    // The hairline is drawn on a span covering the whole slab below the
    // fillet, because a border on the slab itself would run a vertical rule
    // through the wing's fill. That span sits in front of the brand, the nav
    // and the cart: drop `pointer-events-none` and every control in the
    // header goes dead, silently and at every width. jsdom does no hit
    // testing, so the class is the only thing there is to hold onto.
    const outlines = container.querySelectorAll("[data-notch-outline]")

    expect(outlines).toHaveLength(3)
    outlines.forEach((outline) => {
      expect(outline.className).toContain("pointer-events-none")
      expect(outline.getAttribute("aria-hidden")).toBe("true")
    })
  })

  it("draws a fillet on both sides of the centre slab and one on each edge slab", () => {
    const { container } = renderNav()

    // Four wings: the centre slab is flanked, the brand and action slabs have
    // one apiece on the side that faces inward. Without them the bar is three
    // floating pills rather than shapes cut out of the page edge. Matched on
    // the 20x20 viewBox, which is the wings' own — lucide's icons are 24x24.
    expect(container.querySelectorAll('svg[viewBox="0 0 20 20"]')).toHaveLength(
      4,
    )
  })
})
