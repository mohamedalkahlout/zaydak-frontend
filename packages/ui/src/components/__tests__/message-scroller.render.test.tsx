import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "../message-scroller"

/**
 * jsdom lays nothing out, so the scroll behavior itself (anchoring, following
 * the live edge) cannot be pinned here. What can be pinned is the contract the
 * chat surfaces rely on: the accessibility roles, the row attributes the
 * primitive reads back, the localized label reaching the control, and the
 * control being inert when there is nothing to scroll toward — which is every
 * case in a layout-less DOM.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
function Transcript({ label }: { label?: string }) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller>
        <MessageScrollerViewport aria-label="Transcript">
          <MessageScrollerContent>
            <MessageScrollerItem messageId="u1" scrollAnchor>
              <p>Question</p>
            </MessageScrollerItem>
            <MessageScrollerItem messageId="a1">
              <p>Answer</p>
            </MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton label={label} />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

describe("<MessageScroller />", () => {
  it("exposes the transcript as a labelled, focusable log region", () => {
    render(<Transcript />)
    const viewport = screen.getByRole("region", { name: "Transcript" })
    expect(viewport.tabIndex).toBe(0)
    expect(viewport.getAttribute("data-slot")).toBe("message-scroller-viewport")
    const log = screen.getByRole("log")
    expect(log.getAttribute("aria-relevant")).toBe("additions")
    expect(viewport.contains(log)).toBe(true)
  })

  it("marks rows with the id and anchor flag the primitive reads back", () => {
    render(<Transcript />)
    const question = screen.getByText("Question").parentElement!
    const answer = screen.getByText("Answer").parentElement!
    expect(question.getAttribute("data-message-id")).toBe("u1")
    expect(question.getAttribute("data-scroll-anchor")).toBe("true")
    expect(answer.getAttribute("data-message-id")).toBe("a1")
    expect(answer.getAttribute("data-scroll-anchor")).toBe("false")
    // Off-screen rows skip paint work but stay in the DOM.
    expect(question.className).toContain("[content-visibility:auto]")
  })

  it("renders the scroll control inert with the localized name when there is nothing to scroll toward", () => {
    render(<Transcript label="اقفز للأحدث" />)
    const button = screen.getByRole("button", { hidden: true })
    expect(button.getAttribute("data-slot")).toBe("message-scroller-button")
    expect(button.getAttribute("data-direction")).toBe("end")
    expect(button.getAttribute("data-active")).toBe("false")
    expect(button.tabIndex).toBe(-1)
    expect(button.textContent).toContain("اقفز للأحدث")
  })

  it("falls back to an English name when none is given", () => {
    render(<Transcript />)
    const button = screen.getByRole("button", { hidden: true })
    expect(button.textContent).toContain("Scroll to end")
  })
})
