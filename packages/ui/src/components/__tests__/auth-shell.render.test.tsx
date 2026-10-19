import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { AuthShell } from "../auth-shell"
import { AuthHeading } from "../auth-heading"

/**
 * The auth frame is presentational plumbing: slots in, markup out. What these
 * pin is that every slot lands exactly once in the unified card-on-ground
 * composition, that the optional slots leave nothing behind when omitted, and
 * that the shader ground stays decoration: canvas hidden from the accessibility
 * tree, the form inside the light card, the headline never competing with the
 * card's own h1.
 */
describe("<AuthShell />", () => {
  it("renders every slot once", () => {
    render(
      <AuthShell
        brand={<span>Zaydak</span>}
        eyebrow="vendor dashboard"
        headline="Your store takes shape here."
        quote="A quote."
        quoteAuthor="An author"
        chips={["Products & orders", "Live reports"]}
        backLink={<a href="/">Home</a>}
        toolbar={<button>locale</button>}
      >
        <p>the form</p>
      </AuthShell>,
    )
    expect(screen.getAllByText("Zaydak")).toHaveLength(1)
    expect(screen.getByText("Your store takes shape here.")).not.toBeNull()
    expect(screen.getByText("Home")).not.toBeNull()
    expect(screen.getByText("locale")).not.toBeNull()
    expect(screen.getByText("the form")).not.toBeNull()
  })

  // Retired on 2026-09-25 — the headline alone leads the ground — while both
  // apps still pass them, so they are accepted and draw nothing.
  it("accepts the retired eyebrow and quote without drawing them", () => {
    render(
      <AuthShell
        brand="brand"
        eyebrow="vendor dashboard"
        headline="Hero line"
        quote="A quote."
        quoteAuthor="An author"
      >
        form
      </AuthShell>,
    )
    expect(screen.queryByText("vendor dashboard")).toBeNull()
    expect(screen.queryByText("A quote.")).toBeNull()
    expect(screen.queryByText("An author")).toBeNull()
    expect(screen.getByText("Hero line")).not.toBeNull()
  })

  it("keeps the headline out of the heading hierarchy — the card owns the h1", () => {
    const { container } = render(
      <AuthShell brand="brand" headline="Hero line">
        <h1>Welcome back</h1>
      </AuthShell>,
    )
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(screen.getByText("Hero line").tagName).toBe("P")
  })

  it("puts the form inside the white card, below the brand block", () => {
    render(
      <AuthShell brand="brand">
        <p>the form</p>
      </AuthShell>,
    )
    const card = screen.getByText("the form").parentElement as HTMLElement
    expect(card.className).toContain("bg-white")
    // A light island: the tokens re-declare on it and `dark:` stops at it, so
    // a dark `<html>` cannot paint the dark palette over the white surface.
    expect(card.classList.contains("light")).toBe(true)
    expect(card.style.colorScheme).toBe("light")
  })

  it("renders each chip as its own pill", () => {
    render(
      <AuthShell brand="brand" chips={["Products & orders", "Live reports"]}>
        form
      </AuthShell>,
    )
    expect(screen.getByText("Products & orders").tagName).toBe("LI")
    expect(screen.getByText("Live reports").tagName).toBe("LI")
  })

  it("leaves nothing behind when the optional slots are omitted", () => {
    const { container } = render(<AuthShell brand="brand">form</AuthShell>)
    expect(container.querySelector("ul")).toBeNull()
    expect(container.querySelector("blockquote")).toBeNull()
  })

  it("keeps the shader ground out of the accessibility tree", () => {
    const { container } = render(<AuthShell brand="brand">form</AuthShell>)
    const canvases = container.querySelectorAll("canvas")
    expect(canvases.length).toBe(1)
    expect(canvases[0]!.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("<AuthHeading />", () => {
  it("renders the title and description, and no longer the eyebrow", () => {
    render(
      <AuthHeading
        eyebrow="account recovery"
        title="Reset your password"
        description="Enter the code."
      />,
    )
    expect(screen.queryByText("account recovery")).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Reset your password",
    )
    expect(screen.getByText("Enter the code.")).not.toBeNull()
  })

  it("renders the bare title when eyebrow and description are omitted", () => {
    const { container } = render(<AuthHeading title="Welcome back" />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Welcome back",
    )
    // Nothing but the h1 inside the header.
    expect(container.querySelector("header")!.children).toHaveLength(1)
  })
})
