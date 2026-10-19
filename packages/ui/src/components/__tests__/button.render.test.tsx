import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "../button"

/**
 * Base UI's `nativeButton` is not only a development warning: it decides
 * whether the primitive merges `type="button"` or `role="button"`, and which
 * of its two keyboard models it installs. Getting it wrong on a `render={<Link />}`
 * button put `type="button"` on an anchor and logged a console error from every
 * screen that had one. `Button` derives it, so the three cases are pinned apart
 * here rather than left to ~190 call sites.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("<Button />", () => {
  // Stands in for `next/link`: a component, so its output cannot be read off
  // the `render` element — exactly the case that was warning.
  const Link = ({ href, ...props }: { href: string } & React.ComponentProps<"a">) => (
    <a href={href} {...props} />
  )

  it("stays a native button when it renders its own element", () => {
    render(<Button>Save</Button>)
    const el = screen.getByText("Save")
    expect(el.tagName).toBe("BUTTON")
    expect(el.getAttribute("type")).toBe("button")
    expect(el.getAttribute("role")).toBe(null)
  })

  it("drops native button semantics when rendering a link", () => {
    render(<Button render={<Link href="/products" />}>Products</Button>)
    const el = screen.getByText("Products")
    expect(el.tagName).toBe("A")
    // `type` is meaningless on an anchor, and was the visible half of the bug.
    expect(el.getAttribute("type")).toBe(null)
    expect(el.getAttribute("role")).toBe("button")
  })

  it("keeps native semantics for an intrinsic <button> in render", () => {
    render(
      <Button render={<button data-x="1" />}>
        Inner
      </Button>,
    )
    const el = screen.getByText("Inner")
    expect(el.tagName).toBe("BUTTON")
    expect(el.getAttribute("type")).toBe("button")
    expect(el.getAttribute("role")).toBe(null)
  })

  it("lets a call site override the derived value", () => {
    render(
      <Button nativeButton={false} render={<span />}>
        Spanned
      </Button>,
    )
    const el = screen.getByText("Spanned")
    expect(el.tagName).toBe("SPAN")
    expect(el.getAttribute("role")).toBe("button")
  })

  it("logs no Base UI button warning for a link", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<Button render={<Link href="/cart" />}>Cart</Button>)
    expect(
      spy.mock.calls.filter((args) =>
        String(args[0]).includes("acts as a button"),
      ),
    ).toHaveLength(0)
    spy.mockRestore()
  })
})
