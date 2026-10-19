import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { setTestLocale } from "@/features/ai/test-utils/next-intl"
import { InventoryLocationsCard } from "./inventory-locations-card"
import type { InventoryLocationsResult } from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

beforeEach(() => setTestLocale("en"))

/**
 * The card the assistant's "which warehouse?" question opens onto. What
 * matters here is that the vendor can tell the warehouses apart — which one
 * is the default, which one is switched off, which one never ships an online
 * order — because the answer they type back is chosen from this list.
 */

const result = (
  over: Partial<InventoryLocationsResult> = {},
): InventoryLocationsResult => ({
  ok: true,
  count: 2,
  locations: [
    {
      id: "l1",
      name: "Main warehouse",
      city: "Riyadh",
      is_default: true,
      is_active: true,
      fulfills_online_orders: true,
    },
    {
      id: "l2",
      name: "Jeddah branch",
      city: "Jeddah",
      is_default: false,
      is_active: true,
      fulfills_online_orders: true,
    },
  ],
  ...over,
})

describe("<InventoryLocationsCard />", () => {
  it("names every warehouse and marks the default one", () => {
    render(<InventoryLocationsCard result={result()} />)

    expect(screen.getByText("Main warehouse")).toBeTruthy()
    expect(screen.getByText("Jeddah branch")).toBeTruthy()
    // Exactly one badge: two defaults would be a data bug the card must not
    // hide, and zero would leave the vendor guessing where stock lands.
    expect(screen.getAllByText("default")).toHaveLength(1)
  })

  it("hides the quantity column when the lookup named no product", () => {
    const { container } = render(
      <InventoryLocationsCard result={result()} />,
    )
    // No `available` on any row means the numbers would be zeros with no
    // meaning behind them.
    expect(container.textContent).not.toMatch(/committed/)
    expect(container.querySelector(".tabular-nums")).toBeNull()
  })

  it("shows available and committed once a product was named", () => {
    render(
      <InventoryLocationsCard
        result={result({
          locations: [
            {
              id: "l1",
              name: "Main warehouse",
              city: "Riyadh",
              is_default: true,
              is_active: true,
              fulfills_online_orders: true,
              available: 12,
              committed: 3,
            },
            {
              id: "l2",
              name: "Jeddah branch",
              city: "Jeddah",
              is_default: false,
              is_active: true,
              fulfills_online_orders: true,
              available: 0,
              committed: 0,
            },
          ],
        })}
      />,
    )

    expect(screen.getByText("12")).toBeTruthy()
    expect(screen.getByText("3 committed")).toBeTruthy()
    // A location with nothing reserved says nothing about reservations.
    expect(screen.queryByText("0 committed")).toBeNull()
  })

  it("says when a warehouse cannot ship an online order", () => {
    render(
      <InventoryLocationsCard
        result={result({
          locations: [
            {
              id: "l3",
              name: "Showroom",
              city: null,
              is_default: false,
              is_active: false,
              fulfills_online_orders: false,
            },
          ],
          count: 1,
        })}
      />,
    )

    // Stock sitting here is stock the storefront cannot sell, so both facts
    // have to be on the row rather than only in the vendor's memory.
    expect(screen.getByText("off")).toBeTruthy()
    expect(screen.getByText("does not fulfil online orders")).toBeTruthy()
  })

  it("has an Arabic answer for the empty shop", () => {
    setTestLocale("ar")
    render(
      <InventoryLocationsCard
        result={result({ count: 0, locations: [] })}
      />,
    )
    expect(screen.getByText("ما في مخازن مسجّلة")).toBeTruthy()
  })
})
