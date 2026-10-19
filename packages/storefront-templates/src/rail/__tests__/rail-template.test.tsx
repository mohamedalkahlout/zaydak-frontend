import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { RailTemplate } from "../rail-template"

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"]
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
})

describe("RailTemplate", () => {
  it("hangs the sample pieces and opens the one you choose", () => {
    render(<RailTemplate />)

    expect(screen.getByRole("heading", { name: "On the rail" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(10)

    fireEvent.click(screen.getByRole("button", { name: "Open Borovi" }))

    expect(screen.getByRole("heading", { name: "Borovi" })).toBeTruthy()
    expect(screen.getByText("Men's hoodie · Charcoal")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByRole("button", { name: "Back" }).getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: /Close/ }))
    expect(screen.queryByRole("heading", { name: "Borovi" })).toBeNull()
  })
})
