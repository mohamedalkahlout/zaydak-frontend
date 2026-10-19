import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { fill, fillText } from "../lib/fill"

describe("fillText", () => {
  it("fills known placeholders and leaves unknown ones as written", () => {
    expect(fillText("out at {at}", { at: "5:15" })).toBe("out at 5:15")
    expect(fillText("{a} and {b}", { a: "x" })).toBe("x and {b}")
  })
})

describe("fill", () => {
  it("puts elements where the placeholders were", () => {
    const { container } = render(<p>{fill("Back up in {wait}. Set an alarm.", { wait: <bdi>14:50:59</bdi> })}</p>)
    expect(container.querySelector("bdi")?.textContent).toBe("14:50:59")
    expect(container.textContent).toBe("Back up in 14:50:59. Set an alarm.")
  })
})
