import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { BankTransfer } from "../../types"

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
  useApolloClient: vi.fn(() => ({ refetchQueries: vi.fn() })),
  refetch: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
  useApolloClient: () => fixtures.useApolloClient(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const { OrderBankTransfersCard } = await import("../order-bank-transfers-card")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const instructions = {
  id: "acc-1",
  bank_code: "rjhi",
  bank_name: "Al Rajhi Bank",
  account_holder_name: "Osama Jawanh",
  iban: "SA0380000000608010167519",
  currency: "SAR",
}

function pendingTransfer(overrides: Partial<BankTransfer> = {}): BankTransfer {
  return {
    id: "bt-1",
    order_id: "order-1",
    customer_name: "Osama Jawanh",
    bank_account_snapshot: instructions,
    amount_due_cents: 20400,
    currency: "SAR",
    sender_name: "Osama Jawanh",
    transfer_reference: "REF-99",
    transferred_at: "2026-09-11T10:00:00Z",
    receipt_mime_type: "image/jpeg",
    receipt_original_name: "receipt.jpg",
    receipt_url: "http://localhost:3000/bank-transfers/receipts/bt-1",
    status: "PENDING",
    created_at: "2026-09-11T10:00:00Z",
    can_review: true,
    ...overrides,
  }
}

describe("OrderBankTransfersCard", () => {
  it("shows instructed IBAN and a waiting state when no receipt is in yet", () => {
    fixtures.useQuery.mockReturnValue({
      data: { orderBankTransfers: { data: [] } },
      loading: false,
      error: undefined,
      refetch: fixtures.refetch,
    })

    render(
      <OrderBankTransfersCard orderId="order-1" instructions={instructions} />,
    )

    expect(screen.getByText("orderPanelTitle")).toBeTruthy()
    expect(screen.getByText("awaitingReceipt")).toBeTruthy()
    expect(screen.getByText("orderWaitingTitle")).toBeTruthy()
    expect(screen.getByText("Osama Jawanh")).toBeTruthy()
    expect(screen.getByText(/SA03 8000 0000 6080 1016 7519/)).toBeTruthy()
    expect(screen.queryByText("approve")).toBeNull()
  })

  it("exposes view receipt, approve, and reject for a pending reviewable transfer", () => {
    fixtures.useQuery.mockReturnValue({
      data: { orderBankTransfers: { data: [pendingTransfer()] } },
      loading: false,
      error: undefined,
      refetch: fixtures.refetch,
    })

    render(
      <OrderBankTransfersCard orderId="order-1" instructions={instructions} />,
    )

    expect(screen.getByText("status.PENDING")).toBeTruthy()
    expect(screen.getByText("viewReceipt")).toBeTruthy()
    expect(screen.getByText("approve")).toBeTruthy()
    expect(screen.getByText("reject")).toBeTruthy()
    expect(screen.getByText("checkBankBeforeApprove")).toBeTruthy()
    expect(screen.getByText("REF-99")).toBeTruthy()
  })

  it("opens the approve confirm dialog from the order panel", () => {
    fixtures.useQuery.mockReturnValue({
      data: { orderBankTransfers: { data: [pendingTransfer()] } },
      loading: false,
      error: undefined,
      refetch: fixtures.refetch,
    })

    render(
      <OrderBankTransfersCard orderId="order-1" instructions={instructions} />,
    )

    fireEvent.click(screen.getByText("approve"))
    expect(screen.getByText("approveTitle")).toBeTruthy()
    expect(screen.getByText("confirmReceived")).toBeTruthy()
  })
})
