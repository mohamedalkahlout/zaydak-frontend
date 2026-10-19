import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { ToolEventRenderer } from "./tool-event-renderer"
import type { VendorAgentToolEvent } from "@/features/ai/lib/types"

// The form-handoff card routes on click. (No jest-dom in this project —
// assertions use plain DOM properties.)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ shopSlug: "shop" }),
  usePathname: () => "/store/shop/ai",
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * The two shape-driven branches, which are the ones a new tool can fall into
 * without anybody editing this file.
 *
 * `create_product` can end in a question rather than a form — a quantity with
 * no warehouse named, on a shop that has more than one — and it answers with
 * the same `{count, locations}` the lookup does. Keyed on the tool name alone
 * that lands on the generic "Tool: create_product" row, which tells the vendor
 * nothing about the choice they are being asked to make.
 */

const event = (over: Partial<VendorAgentToolEvent>): VendorAgentToolEvent => ({
  name: "create_product",
  args: {},
  ok: true,
  ...over,
})

describe("<ToolEventRenderer />", () => {
  it("renders the warehouse list when a write tool needs a location first", () => {
    render(
      <ToolEventRenderer
        event={event({
          result: {
            ok: true,
            needs_location: true,
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
          },
        })}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.getByText("Warehouses")).toBeTruthy()
    expect(screen.getByText("Jeddah branch")).toBeTruthy()
  })

  it("still renders the form handoff when the create went through", () => {
    render(
      <ToolEventRenderer
        event={event({
          result: {
            ok: true,
            navigate_to_form: {
              target: "product_create",
              url: "/store/shop/products/new",
              prefill: { name: { en: "Hoodie", ar: "" } },
            },
          },
        })}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.queryByText("Warehouses")).toBeNull()
  })

  it("routes a change to the open form to its own card, not the handoff", () => {
    // `patch_form` answers a correction to a form already on screen. Read as
    // a handoff it would offer a button to open the form the vendor is on.
    render(
      <ToolEventRenderer
        event={event({
          name: "patch_form",
          result: {
            ok: true,
            form_patch: {
              patch_id: "patch-1",
              form_id: "h1",
              target: "product_create",
              values: { price: 300 },
              changed: [{ field: "price", from: 200, to: 300 }],
            },
          },
        })}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.getByText("Changed on the open form")).toBeTruthy()
    expect(screen.queryByText("Open form now")).toBeNull()
  })
})
