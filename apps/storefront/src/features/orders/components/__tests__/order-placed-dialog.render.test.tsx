import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"
import { OrderPlacedDialog } from "../order-placed-dialog"

/**
 * The confirmation popup, and the two claims it must never make.
 *
 * **It cannot say "paid".** A card order that succeeds comes back from Stripe
 * to `?placed=1`, usually before its webhook has landed, and every other order
 * here is unpaid anyway — so the copy has to follow `financial_status` rather
 * than the fact that a redirect happened.
 *
 * **The stub is not a value.** `barcodeValue` is the tracking number and the
 * bars are `aria-hidden`, so the number has to survive as text somewhere a
 * screen reader reaches.
 *
 * The mapping onto `BoardingPass` is pinned here rather than in the package,
 * because the package knows nothing about orders: what is worth catching is a
 * slot quietly going empty when a field is null, which is the shape of every
 * real order this app has (`delivery`, `customer` and `addresses` are all
 * nullable).
 */

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

const ORDER = {
  __typename: "OrderEntry",
  id: "o1",
  tracking_number: "AG7890",
  order_status: "pending",
  financial_status: "pending",
  fulfillment_status: "unfulfilled",
  currency: "SAR",
  created_at: "2026-09-07T11:30:00.000Z",
  pricing: {
    subtotal_cents: 24000,
    discount_cents: 0,
    tax_cents: 0,
    delivery_fee_cents: 1500,
    total_cents: 25500,
    paid_total_cents: 0,
  },
  shop: { id: "s1", name: "Acme", slug: "acme", logo: null },
  products: [
    {
      id: "l1",
      product_id: "p1",
      name: "Mug",
      slug: "mug",
      image: null,
      order_quantity: 2,
      unit_price_cents: 12000,
      subtotal_cents: 24000,
      variation_title: null,
    },
  ],
  payment: { gateway: "cash_on_delivery", altered_gateway: null, status: "pending" },
  delivery: { fee_cents: 1500, time: "3-5 days" },
  addresses: {
    shipping: {
      national_address_code: "RIYD1234",
      city: "Riyadh",
      country: "SA",
    },
    billing: null,
  },
  customer: { id: "c1", name: "Elizabeth Wilson", email: null, phone: null },
  shipments: null,
  coupons: null,
  note: null,
  language: null,
  updated_at: "2026-09-07T11:30:00.000Z",
  shipping_method: null,
} as any

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderPlacedDialog
        order={{ ...ORDER, ...overrides }}
        shopName="Acme"
        open
        onClose={() => {}}
      />
    </NextIntlClientProvider>,
  )
}

afterEach(cleanup)

describe("<OrderPlacedDialog />", () => {
  it("asks a bank-transfer buyer to transfer and upload a receipt instead of paying on delivery", () => {
    renderDialog({ payment: { gateway: "BANK_TRANSFER", status: "payment-awaiting-for-approval" } })
    expect(screen.getByText(messages.orderConfirmation.bankTransferNext)).toBeTruthy()
    expect(screen.queryByText(messages.orderConfirmation.payLater)).toBeNull()
  })
  it("fills the pass from the order", () => {
    renderDialog()
    // The shop appears once, as the brand line. It used to appear twice — once
    // there and once as the route row's origin — which cost both ends of that
    // row the width they needed and truncated them to "Ahmed Elect…"/"Riy…".
    expect(screen.getAllByText("Acme")).toHaveLength(1)
    // The destination gets the whole row, so a place name renders in full.
    expect(screen.getByText("Riyadh")).toBeTruthy()
    expect(screen.getByText("Elizabeth Wilson")).toBeTruthy()
    expect(screen.getByText("3-5 days")).toBeTruthy()
    // The tracking number reaches a screen reader as text, not only as bars.
    expect(screen.getByText("AG7890")).toBeTruthy()
  })

  it("does not claim the order is paid when it is not", () => {
    renderDialog()
    expect(screen.getByText(messages.orderConfirmation.payLater)).toBeTruthy()
  })

  it("prints the tracking number under the bars, not only in them", () => {
    // `barcodeValue` draws the stub and is `aria-hidden`; `stubCaption` is the
    // same string as text, and it is the one a customer quotes to the shop.
    renderDialog()
    // The dialog is portalled, so `container` is empty — query the document.
    const stub = document.querySelector('[data-slot="boarding-pass-stub"]')!
    expect(stub.textContent).toContain("AG7890")
  })

  it("thanks by tracking number once the money is actually in", () => {
    renderDialog({ financial_status: "paid" })
    expect(screen.queryByText(messages.orderConfirmation.payLater)).toBeNull()
    // Once on the card, as the caption under the bars. The thank-you sentence
    // also names it but is `sr-only` now that the card carries the moment.
    expect(screen.getAllByText(/AG7890/).length).toBeGreaterThanOrEqual(1)
  })

  it("survives the nullable half of a real order", () => {
    // `delivery`, `customer` and `addresses` are all nullable on OrderEntry,
    // and an order placed before a field existed carries none of them.
    renderDialog({ delivery: null, customer: null, addresses: null })
    expect(screen.getAllByText("Acme")).toHaveLength(1)
    // No estimate invented, and no "undefined" leaking into the pill.
    expect(screen.queryByText("3-5 days")).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it("keeps a labelled close control now that it is an icon", () => {
    renderDialog()
    // The visible label went when the button moved into the striped header;
    // losing it entirely would leave an unlabelled X as the only way out.
    expect(
      screen.getByRole("button", { name: messages.orderConfirmation.viewOrder }),
    ).toBeTruthy()
  })

  it("paints no box around the card", () => {
    renderDialog()
    const content = document.querySelector('[data-slot="dialog-content"]')!
    // `DialogContent` draws its box with `ring-1`, not a border — `border-none`
    // left the outline in place, framing the card with something wider than it.
    expect(content.className).toContain("ring-0")
    expect(content.className).toContain("bg-transparent")
  })

  it("renders nothing while closed", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrderPlacedDialog
          order={ORDER}
          shopName="Acme"
          open={false}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    )
    expect(screen.queryByText("Elizabeth Wilson")).toBeNull()
  })

  it("informs an invoice buyer about payment terms instead of pay on delivery", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrderPlacedDialog
          order={{
            ...ORDER,
            payment: { gateway: "INVOICE", status: "payment-pending", altered_gateway: null },
          }}
          shopName="Acme"
          open={true}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    )
    expect(screen.getByText(messages.orderConfirmation.invoicePaymentPending)).toBeTruthy()
  })
})
