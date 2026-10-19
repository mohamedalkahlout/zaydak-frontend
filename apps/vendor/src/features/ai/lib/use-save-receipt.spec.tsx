import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import type { PrefillPayload } from "@/features/ai/store-prefill"

/**
 * Who gets a receipt, and who does not.
 *
 * The vendor asked for "as soon as I hit save, the assistant knows and tells
 * me". The two ways to get that wrong are both about scope: answering a save
 * the assistant had nothing to do with, and answering twice when a chained
 * step is already about to speak for itself.
 */

const record = vi.fn()
const pushReceipt = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [record, { loading: false }],
}))

vi.mock("@/features/ai/store-chat", () => ({
  useAiChatStore: (selector: (s: unknown) => unknown) =>
    selector({ pushReceipt }),
}))

const { useSaveReceipt } = await import("./use-save-receipt")

const ticket = (over: Partial<PrefillPayload> = {}): PrefillPayload => ({
  target: "product_create",
  handoffId: "h-1",
  conversationId: "c-1",
  values: {},
  expires_at: Date.now() + 60_000,
  ...over,
})

const DETAILS = {
  entity: "product" as const,
  action: "created" as const,
  name: "Autumn Hoodie",
  url: "/store/acme/products/autumn-hoodie/edit",
}

const run = async (handoff: PrefillPayload | null, details = DETAILS) => {
  const { result } = renderHook(() => useSaveReceipt())
  await result.current(handoff, details)
}

beforeEach(() => {
  vi.clearAllMocks()
  record.mockResolvedValue({
    data: {
      vendorAgentSaveReceipt: { id: "m-1", role: "assistant", content: "ok" },
    },
  })
})

describe("useSaveReceipt", () => {
  it("records a save the assistant set up", async () => {
    await run(ticket())

    expect(record).toHaveBeenCalledWith({
      variables: {
        input: {
          conversation_id: "c-1",
          handoff_id: "h-1",
          entity: "product",
          action: "created",
          name: "Autumn Hoodie",
          url: "/store/acme/products/autumn-hoodie/edit",
        },
      },
    })
  })

  it("hands the row to the thread it belongs to", async () => {
    await run(ticket())

    expect(pushReceipt).toHaveBeenCalledWith(
      "c-1",
      expect.objectContaining({ id: "m-1" }),
    )
  })

  it("says nothing about a save the vendor made on their own", async () => {
    await run(null)

    expect(record).not.toHaveBeenCalled()
  })

  it("says nothing when a chained step is about to speak", async () => {
    // "Create a product then a coupon on it": the resume turn is already
    // going to answer. Two messages about one save read as two saves.
    await run(ticket({ nextStep: "اعمل كوبون خصم 15% على هذا المنتج" }))

    expect(record).not.toHaveBeenCalled()
  })

  it("says nothing when the chat had no conversation yet", async () => {
    await run(ticket({ conversationId: undefined }))

    expect(record).not.toHaveBeenCalled()
  })

  it("never turns a successful save into an error", async () => {
    record.mockRejectedValue(new Error("Network error"))

    await expect(run(ticket())).resolves.toBeUndefined()
    expect(pushReceipt).not.toHaveBeenCalled()
  })
})
