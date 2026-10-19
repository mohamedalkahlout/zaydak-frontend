import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import {
  NegotiationCard,
  DEFAULT_NEGOTIATION_DRAFT,
  draftsEqual,
  floorsFromRows,
  type NegotiationDraft,
} from "../negotiation-card"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const mockFeature = {
  allowed: true,
  loading: false,
}

vi.mock("@/features/plan/lib/use-feature", () => ({
  useFeature: () => mockFeature,
}))

const mockPreviewData = {
  previewNegotiationFloor: {
    success: true,
    data: {
      from_minimum_price_cents: 8000,
      from_max_discount_cents: 8200,
      from_minimum_margin_cents: 7500,
      from_dynamic_cents: 0,
      effective_floor_cents: 8500,
      list_price_cents: 10000,
    },
  },
}

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "PreviewNegotiationFloor") {
      return { data: mockPreviewData, loading: false }
    }
    return { data: null, loading: false }
  },
}))

function TestWrapper({
  draft = DEFAULT_NEGOTIATION_DRAFT,
  onChange = vi.fn(),
  onBaselineChange = vi.fn(),
  values = {},
}: {
  draft?: typeof DEFAULT_NEGOTIATION_DRAFT
  onChange?: any
  onBaselineChange?: any
  values?: Record<string, unknown>
}) {
  const form = useForm({
    defaultValues: {
      sale_type: "NEGOTIABLE",
      ...values,
    },
  })

  return (
    <NegotiationCard
      form={form as any}
      productId="prod-123"
      draft={draft}
      onChange={onChange}
      onBaselineChange={onBaselineChange}
    />
  )
}

/** A shirt in three options, the last one added in this edit and unsaved. */
const SHIRT_VALUES = {
  product_type: "VARIABLE",
  variation_options: [
    { id: "v-rm", title: { en: "Red / M", ar: "أحمر / M" }, options: {} },
    { id: "v-rl", title: { en: "" }, options: { Color: "Red", Size: "L" } },
    { title: { en: "Blue / S" }, options: {} },
  ],
}

/** Owns the draft like ProductFormBody does, so every change re-renders the card. */
function StatefulWrapper({
  initial,
  onChange,
  values,
}: {
  initial: NegotiationDraft
  onChange: (next: NegotiationDraft) => void
  values?: Record<string, unknown>
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <TestWrapper
      draft={draft}
      values={values}
      onChange={(next: NegotiationDraft) => {
        setDraft(next)
        onChange(next)
      }}
    />
  )
}

describe("NegotiationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders negotiation controls and live floor preview", () => {
    render(<TestWrapper />)

    // Shows card title and enable switch
    expect(screen.getByText("Allow customers to negotiate")).toBeTruthy()

    // Shows live floor preview effective floor: 85.00
    expect(screen.getByText("85.00")).toBeTruthy()

    // Shows strategy options
    expect(screen.getByLabelText("Balanced")).toBeTruthy()
    expect(screen.getByLabelText("Conservative (firm on price)")).toBeTruthy()
    expect(screen.getByLabelText("Aggressive (flexible to close sale)")).toBeTruthy()

    // Shows TTL input
    expect(screen.getByLabelText("Offer validity (minutes)")).toBeTruthy()

    // Shows coupon stacking switch
    expect(screen.getByText("Allow coupon stacking on negotiated offers")).toBeTruthy()
  })

  it("updates draft when strategy is changed", () => {
    const onChange = vi.fn()
    render(<TestWrapper onChange={onChange} />)

    const conservativeRadio = screen.getByLabelText("Conservative (firm on price)")
    fireEvent.click(conservativeRadio)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: "conservative",
      }),
    )
  })

  it("keeps the typed minimum price until blur, so multi-digit values can be entered", () => {
    const onChange = vi.fn()
    render(
      <StatefulWrapper
        initial={{
          ...DEFAULT_NEGOTIATION_DRAFT,
          floor_mode: "min_price",
          minimum_price_cents: 900,
        }}
        onChange={onChange}
      />,
    )

    // The floor-mode radio carries the same label, so target the number field.
    const input = screen.getByRole("spinbutton", {
      name: "Minimum selling price",
    }) as HTMLInputElement
    expect(input.value).toBe("9.00")

    fireEvent.change(input, { target: { value: "1" } })
    // Previously reformatted to "1.00" here, pushing the next digit past the decimals.
    expect(input.value).toBe("1")

    fireEvent.change(input, { target: { value: "12" } })
    expect(input.value).toBe("12")
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minimum_price_cents: 1200 }),
    )

    fireEvent.blur(input)
    expect(input.value).toBe("12.00")
  })

  it("lists a product's saved options, each negotiating unless switched off", () => {
    render(
      <TestWrapper
        values={SHIRT_VALUES}
        draft={{ ...DEFAULT_NEGOTIATION_DRAFT, excluded_variation_ids: ["v-rl"] }}
      />,
    )

    expect(screen.getByText("Options open to negotiation")).toBeTruthy()
    const redM = screen.getByRole("switch", { name: "Red / M" })
    // Untitled: named by its values.
    const redL = screen.getByRole("switch", { name: "Red / L" })
    expect(redM.getAttribute("aria-checked")).toBe("true")
    expect(redL.getAttribute("aria-checked")).toBe("false")
    // The unsaved one has no id to keep out yet, and says so.
    expect(screen.queryByRole("switch", { name: "Blue / S" })).toBeNull()
    expect(
      screen.getByText(
        "1 new option negotiates once the product is saved, and can be switched off after that.",
      ),
    ).toBeTruthy()
  })

  it("keeps an option switched off out of negotiation", () => {
    const onChange = vi.fn()
    render(<TestWrapper values={SHIRT_VALUES} onChange={onChange} />)

    fireEvent.click(screen.getByRole("switch", { name: "Red / M" }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ excluded_variation_ids: ["v-rm"] }),
    )
  })

  // One amount cannot fit options priced differently.
  it("gives an option a minimum price of its own, and clears it back to the product's", () => {
    const onChange = vi.fn()
    render(
      <StatefulWrapper
        values={SHIRT_VALUES}
        initial={DEFAULT_NEGOTIATION_DRAFT}
        onChange={onChange}
      />,
    )

    const redM = screen.getByRole("spinbutton", {
      name: "Minimum selling price for Red / M",
    }) as HTMLInputElement
    expect(redM.value).toBe("")

    fireEvent.change(redM, { target: { value: "60" } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ option_floors: { "v-rm": 6000 } }),
    )

    fireEvent.change(redM, { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ option_floors: {} }),
    )
  })

  it("offers no own price for an option kept at a fixed price", () => {
    render(
      <TestWrapper
        values={SHIRT_VALUES}
        draft={{
          ...DEFAULT_NEGOTIATION_DRAFT,
          excluded_variation_ids: ["v-rl"],
          option_floors: { "v-rm": 5500 },
        }}
      />,
    )

    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Minimum selling price for Red / M",
        }) as HTMLInputElement
      ).value,
    ).toBe("55.00")
    expect(
      screen.queryByRole("spinbutton", {
        name: "Minimum selling price for Red / L",
      }),
    ).toBeNull()
  })

  it("reads an option's own price only from a row switched on that carries one", () => {
    expect(
      floorsFromRows([
        { variation_option_id: null, enabled: true, minimum_price_cents: 4000 },
        { variation_option_id: "v1", enabled: true, minimum_price_cents: 6000 },
        // Kept at a fixed price.
        { variation_option_id: "v2", enabled: false, minimum_price_cents: 7000 },
        // A discount of its own from the variants table: not a price.
        { variation_option_id: "v3", enabled: true, minimum_price_cents: null },
      ]),
    ).toEqual({ v1: 6000 })
  })

  it("compares two drafts' own prices whatever order they were typed in", () => {
    expect(
      draftsEqual(
        { ...DEFAULT_NEGOTIATION_DRAFT, option_floors: { a: 1, b: 2 } },
        { ...DEFAULT_NEGOTIATION_DRAFT, option_floors: { b: 2, a: 1 } },
      ),
    ).toBe(true)
    expect(
      draftsEqual(
        { ...DEFAULT_NEGOTIATION_DRAFT, option_floors: { a: 1 } },
        { ...DEFAULT_NEGOTIATION_DRAFT, option_floors: { a: 2 } },
      ),
    ).toBe(false)
  })

  it("shows no option switches for a product without options", () => {
    render(<TestWrapper />)
    expect(screen.queryByText("Options open to negotiation")).toBeNull()
  })

  it("updates draft when coupon stacking is toggled", () => {
    const onChange = vi.fn()
    render(<TestWrapper onChange={onChange} />)

    const couponSwitch = screen.getByRole("switch", {
      name: "Allow coupon stacking on negotiated offers",
    })
    fireEvent.click(couponSwitch)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_coupon_stacking: true,
      }),
    )
  })
})
