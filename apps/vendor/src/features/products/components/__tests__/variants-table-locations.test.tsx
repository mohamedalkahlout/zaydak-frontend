import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useForm } from "react-hook-form"

/**
 * The variants table carries the location dimension that used to live in a
 * card of its own, and three things about that have to hold.
 *
 * **"All locations" is read-only.** The number is a sum across warehouses,
 * so there is no single level to write it to — offering an input there would
 * be asking the vendor which warehouse and then picking one for them.
 *
 * **Picking a location makes it editable, and the edit stages.** It goes onto
 * the form's `inventory_levels` for the save bar to flush, not down the wire
 * on blur — that is the rule every other field on this form follows.
 *
 * **A one-location shop never sees the picker** and keeps an editable column.
 * Defaulting it to the read-only aggregate would leave a vendor with a single
 * warehouse no way to set stock at all.
 */

const LOCATIONS = [
  { id: "loc-default", name: "Shop location", is_default: true, is_active: true },
  { id: "loc-tsrs", name: "tsrs", is_default: false, is_active: true },
]

const LEVELS = [
  {
    id: "lvl-1",
    location_id: "loc-default",
    product_id: null,
    variation_option_id: "var-small",
    available: 40,
  },
  {
    id: "lvl-2",
    location_id: "loc-tsrs",
    product_id: null,
    variation_option_id: "var-small",
    available: 7,
  },
]

let locations = LOCATIONS

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: unknown) => {
    const src = JSON.stringify(doc)
    if (src.includes("InventoryLocations")) {
      return { data: { inventoryLocations: { success: true, data: locations } } }
    }
    return { data: { inventoryLevels: { success: true, data: LEVELS } } }
  },
  useMutation: () => [vi.fn(), { loading: false }],
}))

// Real English copy, so "All locations" and the footer read as they do live.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// The real Select is a popup that jsdom never opens, which would make these
// tests about Base UI rather than about the table. Options render inline as
// buttons instead, so picking one is a click.
vi.mock("@repo/ui/components/select", async () => {
  const React = await import("react")
  const ChangeCtx = React.createContext<(v: string) => void>(() => {})
  const ValueCtx = React.createContext<string | null>(null)
  return {
    Select: ({ value, onValueChange, children }: any) =>
      React.createElement(
        ValueCtx.Provider,
        { value: value ?? null },
        React.createElement(ChangeCtx.Provider, { value: onValueChange }, children),
      ),
    SelectTrigger: ({ children, size: _s, ...rest }: any) =>
      React.createElement("button", { type: "button", ...rest }, children),
    // Base UI renders the raw value when given no children, and calls
    // children as a render function when given one. Both, so a trigger that
    // forgot to map an id to a name shows the id here too.
    SelectValue: ({ children }: any) => {
      const value = React.useContext(ValueCtx)
      return React.createElement(
        "span",
        null,
        typeof children === "function" ? children(value) : (children ?? value),
      )
    },
    SelectContent: ({ children, align: _a }: any) =>
      React.createElement("div", null, children),
    SelectItem: ({ value, children }: any) => {
      const onValueChange = React.useContext(ChangeCtx)
      return React.createElement(
        "button",
        { type: "button", onClick: () => onValueChange(value) },
        children,
      )
    },
  }
})

import { VariantsTable } from "../form/variants/variants-table"
import type { ProductFormApi } from "@/features/products/validations/product"

const AXES = [
  { id: "a1", name: "Size", values: ["Small"], isEditing: false },
] as never

/** Renders the table over a real react-hook-form so staging is observable. */
function Harness({
  productId,
  onForm,
}: {
  productId?: string
  onForm: (f: ProductFormApi) => void
}) {
  const form = useForm({
    defaultValues: {
      variation_options: [
        {
          id: "var-small",
          title: { en: "Small" },
          options: { Size: "Small" },
          price: 19.99,
          sku: "TEE-S",
          quantity: 47,
          track_quantity: null,
        },
      ],
      inventory_levels: [],
    },
  })
  onForm(form as unknown as ProductFormApi)
  return (
    <VariantsTable
      form={form as unknown as ProductFormApi}
      axes={AXES}
      productId={productId}
    />
  )
}

describe("VariantsTable — per-location stock", () => {
  beforeEach(() => {
    locations = LOCATIONS
  })

  it("sums every location and offers no input under All locations", () => {
    let form!: ProductFormApi
    render(<Harness productId="p1" onForm={(f) => (form = f)} />)

    // 40 at the default + 7 at tsrs, on the row and again in the footer.
    expect(screen.getAllByText("47").length).toBe(2)
    expect(
      screen.getByText(/Total inventory across all locations/i),
    ).toBeTruthy()
    // Price is still an input; Available is not.
    const numberInputs = document.querySelectorAll('input[type="number"]')
    expect(numberInputs.length).toBe(1)
    expect(form.getValues("inventory_levels")).toEqual([])
  })

  it("stages an edit onto the form once a location is picked", () => {
    let form!: ProductFormApi
    render(<Harness productId="p1" onForm={(f) => (form = f)} />)

    const trigger = screen.getByLabelText("Stock location")
    expect(trigger.textContent).toContain("All locations")

    fireEvent.click(trigger)
    fireEvent.click(screen.getByText("tsrs"))

    // The value is a location id; the trigger has to show its name.
    expect(trigger.textContent).toBe("tsrs")

    const inputs = document.querySelectorAll('input[type="number"]')
    // Price + the now-editable Available for tsrs, seeded from its level.
    expect(inputs.length).toBe(2)
    const available = inputs[1] as HTMLInputElement
    expect(available.value).toBe("7")

    fireEvent.change(available, { target: { value: "12" } })

    expect(form.getValues("inventory_levels")).toEqual([
      {
        variation_option_id: "var-small",
        location_id: "loc-tsrs",
        available: 12,
      },
    ])
    // Staged, not sent. The Apollo mock above exposes `useQuery` alone, so
    // this file stops compiling the day the table reaches for a mutation.
    expect(form.getValues("variation_options.0.quantity")).toBe(47)
  })

  it("says so when the picked location holds none of the product", () => {
    render(<Harness productId="p1" onForm={() => {}} />)

    fireEvent.click(screen.getByLabelText("Stock location"))
    fireEvent.click(screen.getByText("Shop location"))
    const available = document.querySelectorAll('input[type="number"]')[1]
    fireEvent.change(available!, { target: { value: "0" } })

    expect(screen.getByText(/Inventory is not stocked at Shop location/i)).toBeTruthy()
  })

  it("hides the picker and keeps the column editable for a one-location shop", () => {
    locations = [LOCATIONS[0]!]
    render(<Harness productId="p1" onForm={() => {}} />)

    expect(screen.queryByLabelText("Stock location")).toBeNull()
    // Price + Available: the single location is selected implicitly.
    expect(document.querySelectorAll('input[type="number"]').length).toBe(2)
  })

  it("edits the form quantity on create, where there is no location to pick", () => {
    let form!: ProductFormApi
    render(<Harness onForm={(f) => (form = f)} />)

    expect(screen.queryByLabelText("Stock location")).toBeNull()
    const available = document.querySelectorAll('input[type="number"]')[1]
    fireEvent.change(available!, { target: { value: "9" } })

    // `register` holds the raw input value; zod coerces it on submit.
    expect(form.getValues("variation_options.0.quantity")).toBe("9")
    expect(form.getValues("inventory_levels")).toEqual([])
  })
})
