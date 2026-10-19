import { describe, it, expect, vi, beforeAll } from "vitest"
import { useForm, useWatch } from "react-hook-form"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The Shipping card's own decisions, not its looks. Three things carry logic:
// the master toggle swaps the whole body, "More details" summarises what it is
// hiding, and the weight box is expressed in the chosen unit while the form
// keeps grams.

import type {
  ProductFormApi,
  ProductFormInput,
} from "@/features/products/validations/product"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))

const mockPackages = [
  {
    id: "pkg-sample-1",
    shop_id: "shop-1",
    name: "Sample box",
    package_type: "BOX",
    length_mm: 220,
    width_mm: 137,
    height_mm: 42,
    empty_weight_grams: 0,
    is_default: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "pkg-medium",
    shop_id: "shop-1",
    name: "Medium box",
    package_type: "BOX",
    length_mm: 300,
    width_mm: 250,
    height_mm: 150,
    empty_weight_grams: 200,
    is_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

const mockCreatePackage = vi.fn(
  async (options: { variables: { input: Record<string, unknown> } }) => ({
    data: {
      createShopPackage: {
        success: true,
        data: { ...options.variables.input, id: "pkg-created" },
      },
    },
  }),
)

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: {
      shopPackages: {
        data: mockPackages,
      },
    },
    loading: false,
  }),
  useMutation: () => [mockCreatePackage, { loading: false }],
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { ShippingCard } = await import("../form/cards/shipping-card")

beforeAll(() => {
  // Base UI's select and tooltip position with floating-ui, which measures the
  // anchor; jsdom ships no ResizeObserver and the popup never mounts without.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/**
 * The card is asserted through what it renders — the harness echoes the
 * canonical `weight_grams` into the DOM rather than handing the form object out
 * to the test, which would be a write from render into module scope.
 */
function Harness({ defaults }: { defaults?: Partial<ProductFormInput> }) {
  const form = useForm<ProductFormInput>({
    defaultValues: {
      requires_shipping: true,
      ...defaults,
    } as ProductFormInput,
  }) as unknown as ProductFormApi

  return (
    <>
      <ShippingCard form={form} />
      <StoredGrams form={form} />
      <StoredPackage form={form} />
      <button
        type="button"
        onClick={() => form.setValue("weight_unit_display", "G")}
      >
        switch to grams
      </button>
    </>
  )
}

function StoredGrams({ form }: { form: ProductFormApi }) {
  const grams = useWatch({ control: form.control, name: "weight_grams" })
  return (
    <output data-testid="stored-grams">
      {grams === undefined || grams === "" ? "unset" : String(grams)}
    </output>
  )
}

function StoredPackage({ form }: { form: ProductFormApi }) {
  const id = useWatch({ control: form.control, name: "package_id" })
  return <output data-testid="stored-package">{id ?? "unset"}</output>
}

const storedPackage = () => screen.getByTestId("stored-package").textContent

/** Opens the suggestion tray and types the product's own size into it. */
function askForBox([length, width, height]: [string, string, string]) {
  fireEvent.click(screen.getByRole("button", { name: /suggest\.button/ }))
  fireEvent.change(screen.getByLabelText("length"), {
    target: { value: length },
  })
  fireEvent.change(screen.getByLabelText("width"), { target: { value: width } })
  fireEvent.change(screen.getByLabelText("height"), {
    target: { value: height },
  })
}

const weightBox = () =>
  screen.getByLabelText("weight") as HTMLInputElement

const storedGrams = () => screen.getByTestId("stored-grams").textContent

const openDetails = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /originChip|moreDetails/ }),
  )

describe("ShippingCard", () => {
  it("hides the body and explains itself when the product is not physical", () => {
    render(<Harness defaults={{ requires_shipping: false }} />)

    expect(screen.queryByLabelText("weight")).toBeNull()
    expect(screen.getByText("notPhysical")).toBeTruthy()
  })

  it("summarises the collapsed customs fields, with the value once set", () => {
    render(<Harness defaults={{ country_of_origin: "SA", hs_code: "" }} />)

    // A filled field carries its value into the chip; an empty one is
    // label-only, and neither is reachable until the section is opened.
    expect(screen.getByText("SA")).toBeTruthy()
    expect(screen.getByText("hsCodeChip")).toBeTruthy()
    expect(screen.queryByText("moreDetails")).toBeNull()
    expect(screen.queryByLabelText("hsCode")).toBeNull()

    openDetails()

    expect(screen.getByText("moreDetails")).toBeTruthy()
    expect(screen.getByLabelText("hsCode")).toBeTruthy()
  })

  it("stores grams for a weight typed in the selected unit", () => {
    render(<Harness defaults={{ weight_unit_display: "KG" }} />)

    fireEvent.change(weightBox(), { target: { value: "1.5" } })

    expect(storedGrams()).toBe("1500")
    expect(weightBox().value).toBe("1.5")
  })

  it("keeps the typed text when it rounds to a different value", () => {
    render(<Harness defaults={{ weight_unit_display: "KG" }} />)

    // 1.2345 kg is 1234.5 g, stored as 1235 — which reads back as 1.235 kg.
    // The box must not rewrite itself under the cursor.
    fireEvent.change(weightBox(), { target: { value: "1.2345" } })

    expect(storedGrams()).toBe("1235")
    expect(weightBox().value).toBe("1.2345")
  })

  it("re-expresses the same weight when the unit changes", () => {
    render(
      <Harness defaults={{ weight_grams: 2500, weight_unit_display: "KG" }} />,
    )
    expect(weightBox().value).toBe("2.5")

    fireEvent.click(screen.getByRole("button", { name: "switch to grams" }))

    // Switching the unit is not a new weight.
    expect(storedGrams()).toBe("2500")
    expect(weightBox().value).toBe("2500")
  })

  it("seeds the box from a saved product in its stored unit", () => {
    render(
      <Harness defaults={{ weight_grams: 250, weight_unit_display: "G" }} />,
    )

    expect(weightBox().value).toBe("250")
    expect(storedGrams()).toBe("250")
  })

  it("clears the field rather than storing zero for an empty box", () => {
    render(
      <Harness defaults={{ weight_grams: 1000, weight_unit_display: "KG" }} />,
    )

    fireEvent.change(weightBox(), { target: { value: "" } })

    expect(storedGrams()).toBe("unset")
    expect(weightBox().value).toBe("")
  })

  it("displays the default store package when requires_shipping is true", () => {
    render(<Harness />)

    expect(screen.getByText(/Sample box/)).toBeTruthy()
  })

  it("picks the smallest saved box the product fits and marks it suggested", () => {
    render(<Harness />)

    // 20 × 15 × 8 needs 24 × 19 × 12 once padded: the 22 cm sample box is too
    // short, the medium box fits.
    askForBox(["20", "15", "8"])
    fireEvent.click(screen.getByRole("button", { name: /suggest\.find/ }))

    expect(storedPackage()).toBe("pkg-medium")
    expect(screen.getByText("Medium box")).toBeTruthy()
    expect(screen.getByText("suggest.badge")).toBeTruthy()
    // The tray closes on an answer.
    expect(screen.queryByLabelText("length")).toBeNull()
  })

  it("asks for all three measurements before looking", () => {
    render(<Harness />)

    askForBox(["20", "", "8"])
    fireEvent.click(screen.getByRole("button", { name: /suggest\.find/ }))

    expect(screen.getByText("suggest.sizeError")).toBeTruthy()
    expect(storedPackage()).toBe("unset")
  })

  it("finds on Enter instead of submitting the product form", () => {
    render(<Harness />)

    askForBox(["20", "15", "8"])
    // The tray sits inside the product's <form>; an Enter left to the browser
    // would submit it. `fireEvent` returns false once the default is prevented.
    const notPrevented = fireEvent.keyDown(screen.getByLabelText("height"), {
      key: "Enter",
    })

    expect(notPrevented).toBe(false)
    expect(storedPackage()).toBe("pkg-medium")
  })

  it("proposes a new box when none fits, and creates it only on approval", async () => {
    mockCreatePackage.mockClear()
    render(<Harness />)

    askForBox(["50", "40", "30"])
    fireEvent.click(screen.getByRole("button", { name: /suggest\.find/ }))

    expect(screen.getByText("suggest.noFit")).toBeTruthy()
    expect(mockCreatePackage).not.toHaveBeenCalled()
    expect(storedPackage()).toBe("unset")

    fireEvent.click(screen.getByRole("button", { name: /suggest\.create/ }))

    await waitFor(() => expect(storedPackage()).toBe("pkg-created"))
    expect(mockCreatePackage).toHaveBeenCalledTimes(1)
    expect(mockCreatePackage.mock.calls[0][0].variables.input).toMatchObject({
      package_type: "BOX",
      length_mm: 540,
      width_mm: 440,
      height_mm: 340,
      is_default: false,
    })
  })
})
