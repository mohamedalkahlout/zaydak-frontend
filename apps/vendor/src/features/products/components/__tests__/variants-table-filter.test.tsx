import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"

/**
 * The variants table's Search and Filter, which narrow the rows on screen.
 *
 * What is worth pinning is the boundary between the list and the form: a
 * hidden row is skipped at render time, not removed, so every visible input
 * still binds to its original `variation_options.${i}` name and the form
 * keeps every entry. Filter the array first and map by position, and a price
 * typed into the second visible row lands on whichever variant happens to be
 * at index 1 — which is exactly the bug the index-membership check exists to
 * rule out.
 *
 * The table itself is real (a real react-hook-form, real Base UI popover and
 * checkboxes); only the Select popups are swapped for inline buttons, as the
 * locations test does, because jsdom never opens them.
 */

vi.mock("@apollo/client/react", () => ({
  // Create mode skips both queries; the mock ignores `skip` and hands back
  // nothing, which is what a skipped query looks like anyway.
  useQuery: () => ({ data: undefined }),
  useMutation: () => [vi.fn(), { loading: false }],
}))

// Real English copy: the assertions below read "Showing 2 of 4 variants".
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

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
import type { OptionAxis } from "../form/variants/use-variant-options"
import type { ProductFormApi } from "@/features/products/validations/product"

beforeAll(() => {
  // Base UI positions the popover with floating-ui, which measures the
  // anchor. jsdom ships no ResizeObserver, and without one the popup never
  // mounts.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const axis = (id: string, name: string, values: string[]): OptionAxis => ({
  id,
  name,
  values,
  isEditing: false,
  draftName: name,
  draftValues: values,
})

const TWO_AXES = [
  axis("a-size", "Size", ["Small", "Medium"]),
  axis("a-color", "Color", ["Red", "Blue"]),
]
const SIZE_ONLY = [TWO_AXES[0]!]

// Four combinations, in the order the cartesian product builds them; the
// SKUs are what the tests pick a row out by.
const VARIANTS = [
  { options: { Size: "Small", Color: "Red" }, sku: "TEE-S-RED" },
  { options: { Size: "Small", Color: "Blue" }, sku: "TEE-S-BLUE" },
  { options: { Size: "Medium", Color: "Red" }, sku: "TEE-M-RED" },
  { options: { Size: "Medium", Color: "Blue" }, sku: "TEE-M-BLUE" },
].map((v, i) => ({
  id: `var-${i}`,
  title: { en: Object.values(v.options).join(" / ") },
  options: v.options,
  price: 19.99,
  sku: v.sku,
  quantity: 10,
  track_quantity: null,
}))

/** Renders the table over a real react-hook-form so staging is observable. */
function Harness({
  axes = TWO_AXES,
  onForm = () => {},
}: {
  axes?: OptionAxis[]
  onForm?: (f: ProductFormApi) => void
}) {
  const form = useForm({
    defaultValues: { variation_options: VARIANTS, inventory_levels: [] },
  })
  onForm(form as unknown as ProductFormApi)
  return <VariantsTable form={form as unknown as ProductFormApi} axes={axes} />
}

const skusOnScreen = () =>
  VARIANTS.map((v) => v.sku).filter((sku) => screen.queryByText(sku) !== null)

const openSearch = () => {
  fireEvent.click(screen.getByRole("button", { name: "Search variants" }))
  return screen.getByRole("textbox", { name: "Search variants" })
}

const search = (text: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Search variants" }), {
    target: { value: text },
  })

// The popup is portalled and carries no landmark of its own, so it is found
// the way the shells find a dialog: by its slot.
const panel = () =>
  document.querySelector<HTMLElement>('[data-slot="popover-content"]')

const openFilter = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Filter variants" }))
  await waitFor(() => expect(panel()).not.toBeNull())
  return panel()!
}

/** The Filter row for one value: a label wrapping the checkbox. */
const filterRow = (value: string) =>
  within(panel()!).getByText(value).closest("label")!

describe("VariantsTable — search and filter", () => {
  it("opens the box on click and narrows rows by option value or SKU", () => {
    render(<Harness />)
    expect(screen.queryByRole("textbox", { name: "Search variants" })).toBeNull()

    const input = openSearch()
    expect(document.activeElement).toBe(input)
    expect(
      screen.getByRole("button", { name: "Search variants" }).getAttribute("aria-pressed"),
    ).toBe("true")

    // Case-insensitive, on the option value.
    search("med")
    expect(skusOnScreen()).toEqual(["TEE-M-RED", "TEE-M-BLUE"])
    expect(screen.getByText("Showing 2 of 4 variants")).toBeTruthy()

    // ...and on the SKU.
    search("s-blue")
    expect(skusOnScreen()).toEqual(["TEE-S-BLUE"])
    expect(screen.getByText("Showing 1 of 4 variants")).toBeTruthy()

    // Escape clears the query and puts the box away — no hidden filter is
    // left narrowing the table behind a closed control.
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByRole("textbox", { name: "Search variants" })).toBeNull()
    expect(skusOnScreen()).toHaveLength(4)
    expect(screen.queryByText(/Showing \d+ of 4 variants/)).toBeNull()
  })

  it("swallows Enter (the product form is around it) and keeps a non-empty box on blur", () => {
    render(<Harness />)
    const input = openSearch()
    search("red")
    // `fireEvent` returns false when a handler called preventDefault — the
    // one thing standing between Enter here and an implicit form submit.
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false)
    expect(skusOnScreen()).toEqual(["TEE-S-RED", "TEE-M-RED"])

    fireEvent.blur(input)
    expect(screen.getByRole("textbox", { name: "Search variants" })).toBeTruthy()

    // An empty box that loses focus is clutter and goes away.
    search("")
    fireEvent.blur(input)
    expect(screen.queryByRole("textbox", { name: "Search variants" })).toBeNull()
  })

  it("says when nothing matches and its Clear restores every row", () => {
    render(<Harness />)
    openSearch()
    search("xxl")

    expect(skusOnScreen()).toHaveLength(0)
    expect(screen.getByText("No variants match")).toBeTruthy()
    expect(screen.getByText("Showing 0 of 4 variants")).toBeTruthy()
    // The footer is a statement about the product's stock, not the list.
    expect(screen.getByText(/Total inventory/).textContent).toContain("40")

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(skusOnScreen()).toHaveLength(4)
    expect(screen.queryByText("No variants match")).toBeNull()
  })

  it("filters by ticked values, one block per axis, and clears them", async () => {
    render(<Harness />)
    const p = await openFilter()

    expect(within(p).getByText("Size")).toBeTruthy()
    expect(within(p).getByText("Color")).toBeTruthy()
    expect(within(p).getAllByRole("checkbox")).toHaveLength(4)
    expect(within(p).queryByRole("button", { name: "Clear filters" })).toBeNull()

    fireEvent.click(within(filterRow("Red")).getByRole("checkbox"))
    expect(skusOnScreen()).toEqual(["TEE-S-RED", "TEE-M-RED"])
    expect(
      screen.getByRole("button", { name: "Filter variants" }).getAttribute("aria-pressed"),
    ).toBe("true")

    // A second axis narrows further: Small AND Red.
    fireEvent.click(within(filterRow("Small")).getByRole("checkbox"))
    expect(skusOnScreen()).toEqual(["TEE-S-RED"])
    expect(screen.getByText("Showing 1 of 4 variants")).toBeTruthy()

    // Two values on one axis widen it: Small OR Medium, still Red.
    fireEvent.click(within(filterRow("Medium")).getByRole("checkbox"))
    expect(skusOnScreen()).toEqual(["TEE-S-RED", "TEE-M-RED"])

    fireEvent.click(within(p).getByRole("button", { name: "Clear filters" }))
    expect(skusOnScreen()).toHaveLength(4)
    expect(
      screen.getByRole("button", { name: "Filter variants" }).getAttribute("aria-pressed"),
    ).toBe("false")
  })

  it("leaves the form alone: every entry stays, and an edit lands on its own index", async () => {
    let form!: ProductFormApi
    render(<Harness onForm={(f) => (form = f)} />)
    await openFilter()
    fireEvent.click(within(filterRow("Medium")).getByRole("checkbox"))
    fireEvent.click(within(filterRow("Blue")).getByRole("checkbox"))
    expect(skusOnScreen()).toEqual(["TEE-M-BLUE"])

    // Hidden, not gone.
    expect(form.getValues("variation_options")).toHaveLength(4)
    expect(form.getValues("variation_options.0.sku")).toBe("TEE-S-RED")

    // The one visible row is variant 3. Its price input must still be
    // registered as `variation_options.3.price` — re-numbering the visible
    // rows would have made it index 0 and overwritten TEE-S-RED.
    const row = screen.getByText("TEE-M-BLUE").closest<HTMLElement>(".border-t")!
    const price = within(row).getAllByRole("spinbutton")[0]!
    fireEvent.change(price, { target: { value: "25" } })
    expect(form.getValues("variation_options.3.price")).toBe("25")
    expect(form.getValues("variation_options.0.price")).toBe(19.99)
  })

  it("shows matches under a collapsed parent and drops a parent left empty", () => {
    render(<Harness />)
    // Grouped by Size (the first axis). Fold "Small".
    fireEvent.click(screen.getByRole("button", { name: /^Small/ }))
    expect(skusOnScreen()).toEqual(["TEE-M-RED", "TEE-M-BLUE"])

    openSearch()
    search("small")
    // Collapse is ignored while narrowed — a match must never sit hidden
    // under a folded parent — and the Medium group has nothing to show.
    expect(skusOnScreen()).toEqual(["TEE-S-RED", "TEE-S-BLUE"])
    expect(screen.queryByRole("button", { name: /^Medium/ })).toBeNull()
    expect(screen.getByText("2 variants")).toBeTruthy()

    // Clearing the query hands the fold back.
    search("")
    expect(skusOnScreen()).toEqual(["TEE-M-RED", "TEE-M-BLUE"])
  })

  it("drops a ticked value whose axis is gone, rather than hiding every row", async () => {
    const { rerender } = render(<Harness axes={TWO_AXES} />)
    await openFilter()
    fireEvent.click(within(filterRow("Red")).getByRole("checkbox"))
    expect(skusOnScreen()).toEqual(["TEE-S-RED", "TEE-M-RED"])

    // The Color axis is removed while "Red" is still ticked. The tick is
    // stale state; the filter derives from the axes that exist now.
    rerender(<Harness axes={SIZE_ONLY} />)
    expect(skusOnScreen()).toHaveLength(4)
    expect(
      screen.getByRole("button", { name: "Filter variants" }).getAttribute("aria-pressed"),
    ).toBe("false")
    expect(screen.queryByText(/Showing \d+ of 4 variants/)).toBeNull()
  })
})
