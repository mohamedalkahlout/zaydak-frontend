import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import en from "@/shared/messages/en.json"
import { PaymentFeesTable } from "../components/payment-fees-table"

/**
 * The fee screen as an admin meets it: the schedule in the units a person
 * reads, the notice saying what a change does, and a save that reaches the API
 * in basis points and cents.
 */

// The dialog and the select are Base UI popups; jsdom supplies none of what
// they reach for on mount.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

const GATEWAYS = ["STRIPE", "BANK_TRANSFER", "CASH_ON_DELIVERY"]

function fee(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "PaymentGatewayFeeEntry",
    id: "fee_stripe",
    gateway: "STRIPE",
    currency: "SAR",
    fee_bps: 290,
    fee_fixed_cents: 100,
    fee_cap_cents: null,
    active: true,
    updated_at: "2026-10-04T09:00:00.000Z",
    ...overrides,
  }
}

function schedule(overrides: Record<string, unknown> = {}) {
  return {
    paymentGatewayFees: {
      success: true,
      data: [
        fee(),
        fee({
          id: "fee_cod",
          gateway: "CASH_ON_DELIVERY",
          fee_bps: 0,
          fee_fixed_cents: 0,
          active: false,
        }),
      ],
      gateways: GATEWAYS,
      shop_override_count: 0,
      ...overrides,
    },
  }
}

let queryResult: { data?: unknown; loading: boolean; error?: Error | null }
const refetch = vi.fn()
const upsert = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ ...queryResult, refetch }),
  useMutation: () => [upsert, { loading: false }],
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sileo", () => ({ sileo: toast }))

const rowOf = (method: string) =>
  screen.getByText(method).closest("tr") as HTMLElement

beforeEach(() => {
  vi.clearAllMocks()
  upsert.mockResolvedValue({ data: {} })
  queryResult = { data: schedule(), loading: false, error: null }
})

describe("PaymentFeesTable", () => {
  it("lists each fee in a percent and major units, never basis points or cents", () => {
    render(<PaymentFeesTable />)

    const card = within(rowOf("Card (Stripe)"))
    expect(card.getByText("2.9%")).toBeTruthy()
    expect(card.getByText("1.00")).toBeTruthy()
    expect(card.getByText("SAR")).toBeTruthy()
    expect(card.getByText("No cap")).toBeTruthy()
    expect(card.getByText("Charged")).toBeTruthy()
    expect(screen.queryByText("290")).toBeNull()

    const cod = within(rowOf("Cash on delivery"))
    expect(cod.getByText("0%")).toBeTruthy()
    expect(cod.getByText("Off")).toBeTruthy()
    expect(screen.getByText("2 fees")).toBeTruthy()
  })

  it("shows a cap as an amount when the fee has one", () => {
    queryResult.data = schedule({ data: [fee({ fee_cap_cents: 5000 })] })
    render(<PaymentFeesTable />)
    expect(within(rowOf("Card (Stripe)")).getByText("50.00")).toBeTruthy()
    expect(screen.getByText("1 fee")).toBeTruthy()
  })

  it("says what a change does before anything is changed", () => {
    render(<PaymentFeesTable />)

    const notice = screen.getByRole("note")
    expect(within(notice).getByText("What a change does")).toBeTruthy()
    // Every shop, from the next offer; and past figures move too.
    expect(notice.textContent).toContain("applies to every shop at once")
    expect(notice.textContent).toContain("starting with the next session")
    expect(notice.textContent).toContain("so past figures move too")
  })

  it("shows a fee no order can use, without an edit action", () => {
    queryResult.data = schedule({
      data: [fee(), fee({ id: "fee_tabby", gateway: "TABBY", fee_bps: 600 })],
    })
    render(<PaymentFeesTable />)

    // No label in the catalogue, so the code itself, never a blank cell.
    const tabby = within(rowOf("TABBY"))
    expect(tabby.getByText("6%")).toBeTruthy()
    expect(tabby.getByText(/No order can be paid this way/)).toBeTruthy()
    expect(tabby.queryByRole("button")).toBeNull()
    expect(
      within(rowOf("Card (Stripe)")).getByRole("button", {
        name: "Edit the fee for Card (Stripe)",
      }),
    ).toBeTruthy()
  })

  it("says when shops have fees of their own that this screen cannot edit", () => {
    render(<PaymentFeesTable />)
    expect(screen.queryByText(/outside this screen/)).toBeNull()

    queryResult.data = schedule({ shop_override_count: 2 })
    render(<PaymentFeesTable />)
    expect(
      screen.getByText(/2 fees are set for single shops outside this screen/),
    ).toBeTruthy()
  })

  it("reads an empty schedule as zero fees, not as a failure", () => {
    queryResult.data = schedule({ data: [] })
    render(<PaymentFeesTable />)
    expect(
      screen.getByText(
        "No payment fees yet. A payment method with no fee is priced at zero.",
      ),
    ).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("says so when the schedule cannot be loaded, and offers nothing to add", () => {
    queryResult = { data: undefined, loading: false, error: new Error("boom") }
    render(<PaymentFeesTable />)

    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load the payment fees.",
    )
    // The picker's methods come from the list, so there is nothing to offer.
    expect(
      (screen.getByRole("button", { name: "Add fee" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })
})

describe("PaymentFeesTable — editing a fee", () => {
  const openEdit = (method: string) => {
    render(<PaymentFeesTable />)
    fireEvent.click(
      screen.getByRole("button", { name: `Edit the fee for ${method}` }),
    )
    return within(screen.getByRole("dialog"))
  }

  it("opens on the row's own terms, in a percent and major units", () => {
    const dialog = openEdit("Card (Stripe)")

    expect(dialog.getByText("Edit the fee for Card (Stripe)")).toBeTruthy()
    expect(
      (
        dialog.getByLabelText(
          "Percentage of the amount charged",
        ) as HTMLInputElement
      ).value,
    ).toBe("2.9")
    expect(
      (dialog.getByLabelText("Fixed fee per order") as HTMLInputElement).value,
    ).toBe("1")
    expect(
      (dialog.getByLabelText("Cap per order") as HTMLInputElement).value,
    ).toBe("")
  })

  it("repeats what a change does beside the Save button", () => {
    const dialog = openEdit("Card (Stripe)")
    expect(
      dialog.getByText(/applies to every shop at once/).textContent,
    ).toContain("so past figures move too")
  })

  it("fixes the payment method and the currency: they name the fee", () => {
    const dialog = openEdit("Card (Stripe)")
    expect(
      (dialog.getByLabelText("Currency") as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      dialog.getByRole("combobox").hasAttribute("disabled") ||
        dialog.getByRole("combobox").getAttribute("aria-disabled") === "true",
    ).toBe(true)
  })

  it("saves a cash-on-delivery fee as basis points and cents, and reloads the list", async () => {
    const dialog = openEdit("Cash on delivery")

    fireEvent.change(dialog.getByLabelText("Fixed fee per order"), {
      target: { value: "5.5" },
    })
    fireEvent.click(dialog.getByRole("switch"))
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1))
    expect(upsert).toHaveBeenCalledWith({
      variables: {
        input: {
          gateway: "CASH_ON_DELIVERY",
          currency: "SAR",
          fee_bps: 0,
          fee_fixed_cents: 550,
          fee_cap_cents: null,
          active: true,
        },
      },
    })
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith({ title: "Payment fee saved" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("sends a typed cap in cents and a cleared one as none", async () => {
    const dialog = openEdit("Card (Stripe)")
    fireEvent.change(dialog.getByLabelText("Cap per order"), {
      target: { value: "50" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1))
    expect(upsert.mock.calls[0][0].variables.input).toMatchObject({
      fee_bps: 290,
      fee_fixed_cents: 100,
      fee_cap_cents: 5000,
    })
  })

  it("refuses a percentage over the ceiling without calling the API", async () => {
    const dialog = openEdit("Card (Stripe)")
    // 2.9% mistyped as 29.
    fireEvent.change(
      dialog.getByLabelText("Percentage of the amount charged"),
      {
        target: { value: "29" },
      },
    )
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    expect(
      await dialog.findByText("The percentage cannot exceed 20%"),
    ).toBeTruthy()
    expect(upsert).not.toHaveBeenCalled()
  })

  it("refuses a cap below the fixed fee without calling the API", async () => {
    const dialog = openEdit("Card (Stripe)")
    fireEvent.change(dialog.getByLabelText("Cap per order"), {
      target: { value: "0.5" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    expect(
      await dialog.findByText("The cap cannot be below the fixed fee"),
    ).toBeTruthy()
    expect(upsert).not.toHaveBeenCalled()
  })

  it("keeps the form open and says why when the API refuses the save", async () => {
    upsert.mockRejectedValue(new Error("Insufficient permissions"))
    const dialog = openEdit("Card (Stripe)")
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    expect(
      (await dialog.findByText(/Could not save the payment fee/)).textContent,
    ).toContain("Insufficient permissions")
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(refetch).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe("PaymentFeesTable — adding a fee", () => {
  const openAdd = () => {
    render(<PaymentFeesTable />)
    fireEvent.click(screen.getByRole("button", { name: "Add fee" }))
    return within(screen.getByRole("dialog"))
  }

  it("starts empty, charged, in the schedule's currency, with nothing picked", () => {
    const dialog = openAdd()

    expect(dialog.getByText("Add a payment fee")).toBeTruthy()
    expect((dialog.getByLabelText("Currency") as HTMLInputElement).value).toBe(
      "SAR",
    )
    expect(
      (dialog.getByLabelText("Currency") as HTMLInputElement).disabled,
    ).toBe(false)
    expect(dialog.getByText("Choose a payment method")).toBeTruthy()
    expect(dialog.getByRole("switch").getAttribute("aria-checked")).toBe("true")
  })

  it("asks for a payment method before it will save", async () => {
    const dialog = openAdd()
    fireEvent.click(dialog.getByRole("button", { name: "Save" }))

    expect(await dialog.findByRole("alert")).toBeTruthy()
    expect(dialog.getByRole("alert").textContent).toBe(
      "Choose a payment method",
    )
    expect(upsert).not.toHaveBeenCalled()
  })
})
