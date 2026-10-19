import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { CheckoutFrameProps } from "../checkout-frame"
import { DoughnCheckoutFrame } from "../doughn/checkout-frame"
import { DripCheckoutFrame } from "../drip/checkout-frame"
import { HulloCheckoutFrame } from "../hullo/checkout-frame"
import { JuratCheckoutFrame } from "../jurat/checkout-frame"
import { PersonneCheckoutFrame } from "../personne/checkout-frame"
import { RailCheckoutFrame } from "../rail/checkout-frame"

vi.mock("next/font/google", () => {
  const font = () => ({ style: { fontFamily: "Test" }, variable: "font-var" })
  return {
    Alexandria: font,
    Bagel_Fat_One: font,
    Bricolage_Grotesque: font,
    Archivo: font,
    DM_Mono: font,
    Doto: font,
    Figtree: font,
    Hanken_Grotesk: font,
    IBM_Plex_Sans: font,
    IBM_Plex_Sans_Arabic: font,
    Lalezar: font,
    Newsreader: font,
    Reem_Kufi: font,
    Shantell_Sans: font,
  }
})

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

function props(onPlace: () => void): CheckoutFrameProps {
  return {
    shopName: "Sample",
    homeHref: "/home",
    title: "Checkout",
    backHref: "/bag",
    backLabel: "Back",
    lines: [{ id: "1", name: "Pistachio", qty: 2 }],
    moneyRows: [{ label: "Subtotal", value: "16 SAR" }],
    totalLabel: "Total",
    total: "16 SAR",
    pending: false,
    placeLabel: "Place order",
    placingLabel: "Placing",
    placing: false,
    canPlace: true,
    onPlace,
    fields: <input aria-label="Name" defaultValue="Lina" />,
    empty: null,
    loading: false,
  }
}

describe("template checkout frames", () => {
  it.each([
    ["doughn", DoughnCheckoutFrame],
    ["drip", DripCheckoutFrame],
    ["rail", RailCheckoutFrame],
    ["hullo", HulloCheckoutFrame],
    ["personne", PersonneCheckoutFrame],
    ["jurat", JuratCheckoutFrame],
  ])("%s places an order from its own frame", (_name, Frame) => {
    const onPlace = vi.fn()
    render(<Frame {...props(onPlace)} />)
    expect(screen.getByRole("link", { name: "Sample" })).toBeTruthy()
    expect(screen.getByText("Pistachio")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Place order" }))
    expect(onPlace).toHaveBeenCalledOnce()
  })

  it("shows the empty bag instead of the place button", () => {
    render(
      <DoughnCheckoutFrame
        {...props(vi.fn())}
        empty={{ title: "Nothing to check out", href: "/products", action: "Continue" }}
        lines={[]}
      />,
    )
    expect(screen.getByText("Nothing to check out")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull()
  })
})
