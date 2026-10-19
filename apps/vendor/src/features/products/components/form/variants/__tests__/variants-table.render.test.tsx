import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { OptionAxis } from "../use-variant-options"
import type { ProductFormApi } from "@/features/products/validations/product"

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: undefined }),
  // VariantsTable upserts the per-variant negotiation policy.
  useMutation: () => [vi.fn().mockResolvedValue({ data: {} }), { loading: false }],
}))

// The table's copy comes from the real English catalogue, so a query by its
// text ("2 variants") still reads what a merchant reads.
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

const { VariantsTable } = await import("../variants-table")

beforeAll(() => {
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

const SINGLE_AXIS = [axis("a-size", "Size", ["Small", "Medium", "Large"])]

const TWO_AXES = [
  axis("a-size", "Size", ["Small", "Medium"]),
  axis("a-color", "Color", ["Red", "Blue"]),
]

const SINGLE_VARIANTS = [
  { id: "var-s", title: { en: "Small" }, options: { Size: "Small" }, price: 29.99, sku: "SHIRT-S", quantity: 15 },
  { id: "var-m", title: { en: "Medium" }, options: { Size: "Medium" }, price: 29.99, sku: "SHIRT-M", quantity: 20 },
  { id: "var-l", title: { en: "Large" }, options: { Size: "Large" }, price: 34.99, sku: "SHIRT-L", quantity: 10 },
]

const MULTI_VARIANTS = [
  { id: "var-0", title: { en: "Small / Red" }, options: { Size: "Small", Color: "Red" }, price: 25, sku: "TEE-S-RED", quantity: 10 },
  { id: "var-1", title: { en: "Small / Blue" }, options: { Size: "Small", Color: "Blue" }, price: 25, sku: "TEE-S-BLUE", quantity: 12 },
  { id: "var-2", title: { en: "Medium / Red" }, options: { Size: "Medium", Color: "Red" }, price: 27, sku: "TEE-M-RED", quantity: 8 },
  { id: "var-3", title: { en: "Medium / Blue" }, options: { Size: "Medium", Color: "Blue" }, price: 27, sku: "TEE-M-BLUE", quantity: 5 },
]

function Harness({
  axes,
  variants,
  onForm,
}: {
  axes: OptionAxis[]
  variants: any[]
  onForm?: (f: ProductFormApi) => void
}) {
  const form = useForm({
    defaultValues: { variation_options: variants, inventory_levels: [] },
  })
  onForm?.(form as unknown as ProductFormApi)
  return <VariantsTable form={form as unknown as ProductFormApi} axes={axes} />
}

describe("<VariantsTable /> matrix rendering & editing", () => {
  it("renders single-axis variant rows with price, SKU, and availability", () => {
    render(<Harness axes={SINGLE_AXIS} variants={SINGLE_VARIANTS} />)

    expect(screen.getByText("Small")).toBeDefined()
    expect(screen.getByText("Medium")).toBeDefined()
    expect(screen.getByText("Large")).toBeDefined()

    expect(screen.getByText("SHIRT-S")).toBeDefined()
    expect(screen.getByText("SHIRT-M")).toBeDefined()
    expect(screen.getByText("SHIRT-L")).toBeDefined()

    expect(screen.getAllByDisplayValue("29.99").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByDisplayValue("15")).toBeDefined()
  })

  it("renders multi-axis combinations grouped by the primary axis", () => {
    render(<Harness axes={TWO_AXES} variants={MULTI_VARIANTS} />)

    // Primary axis grouped parents
    expect(screen.getByText("Small")).toBeDefined()
    expect(screen.getByText("Medium")).toBeDefined()

    // Child combinations rendered under parents
    expect(screen.getByText("TEE-S-RED")).toBeDefined()
    expect(screen.getByText("TEE-S-BLUE")).toBeDefined()
    expect(screen.getByText("TEE-M-RED")).toBeDefined()
    expect(screen.getByText("TEE-M-BLUE")).toBeDefined()
  })

  it("updates form state when editing a variant price inline", () => {
    let formRef: ProductFormApi | null = null

    render(
      <Harness
        axes={SINGLE_AXIS}
        variants={SINGLE_VARIANTS}
        onForm={(f) => {
          formRef = f
        }}
      />,
    )

    const priceInputs = screen.getAllByDisplayValue("29.99")
    fireEvent.change(priceInputs[0]!, { target: { value: "39.99" } })

    const formValues = formRef!.getValues()
    expect(formValues.variation_options[0].price).toBe("39.99")
  })

  it("updates available quantity in create mode", () => {
    let formRef: ProductFormApi | null = null

    render(
      <Harness
        axes={SINGLE_AXIS}
        variants={SINGLE_VARIANTS}
        onForm={(f) => {
          formRef = f
        }}
      />,
    )

    const qtyInputs = screen.getAllByDisplayValue("15")
    fireEvent.change(qtyInputs[0]!, { target: { value: "45" } })

    const formValues = formRef!.getValues()
    expect(Number(formValues.variation_options[0].quantity)).toBe(45)
  })

  it("collapses and expands parent group rows", () => {
    render(<Harness axes={TWO_AXES} variants={MULTI_VARIANTS} />)

    // Small group is expanded initially: TEE-S-RED is in the DOM
    expect(screen.getByText("TEE-S-RED")).toBeDefined()

    // Click on Small group header to collapse it
    const smallHeaderButton = screen.getByRole("button", { name: /Small.*variant/i })
    fireEvent.click(smallHeaderButton)

    // Now collapsed, children are no longer in DOM
    expect(screen.queryByText("TEE-S-RED")).toBeNull()

    // Click again to re-expand
    fireEvent.click(smallHeaderButton)
    expect(screen.getByText("TEE-S-RED")).toBeDefined()
  })
})
