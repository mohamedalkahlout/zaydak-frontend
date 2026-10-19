import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"
import { SectionHeading } from "../section-heading"

function renderHeading(props: Parameters<typeof SectionHeading>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SectionHeading {...props} />
    </NextIntlClientProvider>,
  )
}

/**
 * The heading is the front page's spine, so the two things worth pinning are
 * the zero-padded index (a ragged number column is what makes a numbered layout
 * look accidental) and the fact that the "view all" link is optional — several
 * sections have no catalogue view to send anyone to.
 */
describe("SectionHeading", () => {
  it("zero-pads a single-digit index", () => {
    renderHeading({ index: 1, title: "Most looked at" })
    expect(screen.getByText("01")).toBeTruthy()
  })

  it("leaves a two-digit index alone", () => {
    renderHeading({ index: 12, title: "Most looked at" })
    expect(screen.getByText("12")).toBeTruthy()
  })

  it("renders the title as a heading", () => {
    renderHeading({ index: 2, title: "The shelves" })
    expect(screen.getByRole("heading", { name: "The shelves" })).toBeTruthy()
  })

  it("renders no link when there is nowhere to send anyone", () => {
    renderHeading({ index: 3, title: "How buying here works" })
    expect(screen.queryAllByRole("link")).toHaveLength(0)
  })

  it("renders the action twice — one per breakpoint — pointing at one href", () => {
    // Two nodes rather than one that moves: the rule between the title and the
    // action has to stay unbroken at every width, which it cannot do if the
    // link is inside a wrapper that reflows.
    renderHeading({
      index: 4,
      title: "Just landed",
      href: "/acme/products",
      actionLabel: "Open",
    })

    const links = screen.getAllByRole("link", { name: "Open" })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/acme/products")
    }
  })

  it("shows the note only when one is given", () => {
    const { rerender } = renderHeading({ index: 5, title: "Marked down" })
    expect(screen.queryByText("Still here, now cheaper.")).toBeNull()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SectionHeading
          index={5}
          title="Marked down"
          note="Still here, now cheaper."
        />
      </NextIntlClientProvider>,
    )
    expect(screen.getByText("Still here, now cheaper.")).toBeTruthy()
  })
})
