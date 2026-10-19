import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

import { AssistantTurnError } from "../lib/stream"
import { useAssistantStore } from "../store"
import { useAssistant } from "../use-assistant"

const streamTurn = vi.hoisted(() => vi.fn())
const ask = vi.hoisted(() => vi.fn())

vi.mock("../lib/stream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/stream")>()),
  streamAssistantTurn: streamTurn,
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [ask],
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/acme",
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme" }),
}))

vi.mock("@/shared/lib/use-shop-slug", () => ({
  useShopTenant: () => ({ mode: "path", slug: "acme", base: "/acme" }),
}))

vi.mock("@/shared/stores/cart-session", () => ({
  useCartSessionStore: (select: (s: { adopt: () => string }) => unknown) =>
    select({ adopt: () => "sess-1" }),
}))

/**
 * The hook's two transports, and when it may use the second.
 *
 * The mutation is the fallback for a stream that never opened. A stream that
 * opened and was refused is not that: re-running the turn through the mutation
 * is refused again, and it used to cost the shopper the one thing the refusal
 * knew — how long to wait.
 */

/** A stream that throws `err` before yielding anything. */
function failingStream(err: unknown) {
  return (async function* () {
    throw err
  })()
}

async function send(text: string) {
  const { result } = renderHook(() => useAssistant())
  await act(async () => {
    await result.current.send(text)
  })
}

function lastMessage() {
  const messages = useAssistantStore.getState().messages
  return messages[messages.length - 1]
}

beforeEach(() => {
  streamTurn.mockReset()
  ask.mockReset()
  useAssistantStore.setState({ messages: [] })
})

describe("useAssistant", () => {
  it("shows the wait from a refused stream and does not re-run the turn", async () => {
    streamTurn.mockReturnValue(
      failingStream(new AssistantTurnError("TOO_MANY_REQUESTS", 540)),
    )

    await send("do you have totes?")

    expect(ask).not.toHaveBeenCalled()
    expect(lastMessage()).toMatchObject({
      role: "assistant",
      failed: true,
      refused: { retryAfterSeconds: 540 },
    })
  })

  it("does not re-run a turn the stream failed for another reason", async () => {
    streamTurn.mockReturnValue(
      failingStream(new AssistantTurnError(null, null)),
    )

    await send("hi")

    expect(ask).not.toHaveBeenCalled()
    expect(lastMessage()).toMatchObject({ failed: true })
    expect(lastMessage().refused).toBeUndefined()
  })

  it("falls back to the mutation when the stream never opened", async () => {
    streamTurn.mockReturnValue(
      failingStream(new Error("Assistant stream unavailable (502)")),
    )
    ask.mockResolvedValue({
      data: {
        askShopAssistant: {
          data: {
            text: "Here you go",
            products: [],
            searched_for: [],
            additions: [],
            negotiation_offers: [],
            escalated: false,
          },
        },
      },
    })

    await send("hi")

    expect(ask).toHaveBeenCalledTimes(1)
    expect(lastMessage()).toMatchObject({
      role: "assistant",
      text: "Here you go",
    })
  })

  it("shows the wait when the mutation fallback is refused", async () => {
    // A stream that did not open for a reason of its own (a proxy's 502); a
    // 429 on the stream is a refusal and never reaches the mutation.
    streamTurn.mockReturnValue(
      failingStream(new Error("Assistant stream unavailable (502)")),
    )
    ask.mockRejectedValue(
      new CombinedGraphQLErrors({ data: null }, [
        {
          message: "Too many requests",
          extensions: {
            error_code: "TOO_MANY_REQUESTS",
            detail: "retry_after_seconds=45",
          },
        },
      ]),
    )

    await send("hi")

    expect(lastMessage()).toMatchObject({
      failed: true,
      refused: { retryAfterSeconds: 45 },
    })
  })
})
