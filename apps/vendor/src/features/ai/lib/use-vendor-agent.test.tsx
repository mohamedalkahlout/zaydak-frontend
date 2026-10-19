import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

// The hook reaches for Apollo only to reload a stored conversation, which
// this suite never does. Stubbing it keeps the test free of an
// ApolloProvider it would otherwise need purely as scaffolding.
vi.mock("@apollo/client/react", () => ({
  useLazyQuery: () => [vi.fn().mockResolvedValue({ data: null }), {}],
}))

// The hook writes its own error sentences in the dashboard's language.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { findPendingTool, useVendorAgent } from "./use-vendor-agent"
import type { VendorAgentToolEvent } from "./types"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import { useLiveFormStore } from "@/features/ai/store-live-form"

/**
 * Feed the hook an SSE body and leave it OPEN.
 *
 * Progress lives in `streaming`, which the hook collapses into a committed
 * message the moment the socket closes — so a stream that ends has already
 * thrown away the thing under test. Every case here closes it explicitly
 * once its assertions are done.
 */
function openStream(frames: Array<[string, unknown]>) {
  const encoder = new TextEncoder()
  let ctrl: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller
      for (const [type, data] of frames) {
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }
    },
  })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }))
  return { close: () => ctrl?.close() }
}

type Hook = { current: ReturnType<typeof useVendorAgent> }

/** The tool rows of the turn currently streaming. */
function streamingTools(result: Hook): VendorAgentToolEvent[] {
  return result.current.streaming?.tool_events ?? []
}

async function start(frames: Array<[string, unknown]>, rows: number) {
  const stream = openStream(frames)
  const { result } = renderHook(() => useVendorAgent())
  act(() => {
    void result.current.send("do the thing")
  })
  await waitFor(() => expect(streamingTools(result)).toHaveLength(rows))
  return { result, stream }
}

describe("useVendorAgent — tool_progress", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "token", isAuthenticated: true })
    useActiveShopStore.setState({ slug: "acme" })
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("attaches the latest frame to the running tool", async () => {
    const { result, stream } = await start(
      [
        [
          "tool_start",
          { name: "import_products_csv", args: {}, call_id: "call-1" },
        ],
        [
          "tool_progress",
          {
            name: "import_products_csv",
            call_id: "call-1",
            phase: "importing",
            done: 40,
            total: 100,
            label: "red-wallet",
          },
        ],
        [
          "tool_progress",
          {
            name: "import_products_csv",
            call_id: "call-1",
            phase: "importing",
            done: 90,
            total: 100,
          },
        ],
      ],
      1,
    )

    // Replaced, not merged: the second frame names no label, and keeping the
    // first one's would caption the row with a product it has moved past.
    await waitFor(() =>
      expect(streamingTools(result)[0].progress).toEqual({
        phase: "importing",
        done: 90,
        total: 100,
        label: undefined,
      }),
    )
    act(() => stream.close())
  })

  it("clears the progress when the result lands", async () => {
    const { result, stream } = await start(
      [
        ["tool_start", { name: "bulk_update_price", args: {}, call_id: "c1" }],
        [
          "tool_progress",
          { name: "bulk_update_price", call_id: "c1", phase: "applying" },
        ],
        [
          "tool_result",
          {
            name: "bulk_update_price",
            call_id: "c1",
            ok: true,
            result: { updated: 12 },
          },
        ],
      ],
      1,
    )

    await waitFor(() =>
      expect(streamingTools(result)[0].result).toEqual({ updated: 12 }),
    )
    // A bar left under a finished row reads as still working.
    expect(streamingTools(result)[0].progress).toBeNull()
    act(() => stream.close())
  })

  it("drops a frame for a call it never saw start", async () => {
    const { result, stream } = await start(
      [
        ["tool_start", { name: "get_product", args: {}, call_id: "c1" }],
        ["tool_progress", { name: "other_tool", call_id: "ghost", done: 1 }],
      ],
      1,
    )

    // Advisory frames carry no result, so an unmatched one is dropped rather
    // than inventing a row nobody announced.
    expect(streamingTools(result)[0].progress).toBeUndefined()
    act(() => stream.close())
  })

  it("keeps two same-name calls apart — what call_id buys", async () => {
    const { result, stream } = await start(
      [
        ["tool_start", { name: "search_products", args: {}, call_id: "a" }],
        ["tool_start", { name: "search_products", args: {}, call_id: "b" }],
        [
          "tool_progress",
          { name: "search_products", call_id: "b", phase: "x", done: 7 },
        ],
        [
          "tool_result",
          {
            name: "search_products",
            call_id: "b",
            ok: true,
            result: { total: 2 },
          },
        ],
      ],
      2,
    )

    await waitFor(() =>
      expect(streamingTools(result)[1].result).toEqual({ total: 2 }),
    )
    // Both frames named call `b`. Matching on the tool name alone would have
    // put the progress and the result on `a`, which is still running.
    const [first, second] = streamingTools(result)
    expect(first.progress).toBeUndefined()
    expect(first.result).toBeNull()
    expect(second.progress).toBeNull()
    act(() => stream.close())
  })

  it("leaves a silent tool exactly as it was", async () => {
    const { result, stream } = await start(
      [
        ["tool_start", { name: "get_shop_stats", args: {}, call_id: "c1" }],
        [
          "tool_result",
          {
            name: "get_shop_stats",
            call_id: "c1",
            ok: true,
            result: { ok: 1 },
          },
        ],
      ],
      1,
    )

    await waitFor(() =>
      expect(streamingTools(result)[0].result).toEqual({ ok: 1 }),
    )
    act(() => stream.close())
  })
})

describe("findPendingTool", () => {
  const row = (
    name: string,
    call_id?: string,
    result: unknown = null,
  ): VendorAgentToolEvent => ({ name, args: {}, ok: true, result, call_id })

  it("prefers an exact call id over the tool name", () => {
    const events = [row("search_products", "a"), row("search_products", "b")]
    expect(findPendingTool(events, "search_products", "b")).toBe(events[1])
  })

  it("falls back to the OLDEST unresolved call of that name", () => {
    // No ids at all — a turn streamed by a back-end that predates them. Calls
    // dispatch serially, so the first started is the first to finish.
    const events = [row("search_products"), row("search_products")]
    expect(findPendingTool(events, "search_products")).toBe(events[0])
  })

  it("skips a call that already has its result", () => {
    const events = [
      row("search_products", undefined, { total: 1 }),
      row("search_products"),
    ]
    expect(findPendingTool(events, "search_products")).toBe(events[1])
  })

  it("returns undefined when nothing matches", () => {
    expect(findPendingTool([], "search_products", "z")).toBeUndefined()
  })
})

/**
 * The live form channel. The open product form travels with each message so
 * the assistant can patch it, and a `patch_form` result is staged into that
 * form the moment its frame arrives. An API without the channel ignores the
 * field, so the body only ever gains it while a form is actually live.
 */
describe("useVendorAgent — the live form", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "token", isAuthenticated: true })
    useActiveShopStore.setState({ slug: "acme" })
    localStorage.clear()
    useVendorAgentPrefillStore.setState({ pending: {} })
    useLiveFormStore.setState({ current: null, outcomes: {} })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** The JSON body of the n-th request the hook made. */
  const sentBody = (n = 0): Record<string, unknown> => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const init = fetchMock.mock.calls[n][1] as { body: string }
    return JSON.parse(init.body) as Record<string, unknown>
  }

  const liveForm = () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    const apply = vi.fn((values: Record<string, unknown>) => values)
    useLiveFormStore.getState().register({
      formId,
      target: "product_create",
      snapshot: () => ({ price: 200 }),
      apply,
    })
    return { formId, apply }
  }

  it("sends no form when none is open", async () => {
    const stream = openStream([["done", { reply: "ok", tool_events: [] }]])
    const { result } = renderHook(() => useVendorAgent())
    await act(async () => {
      await result.current.send("hello")
    })
    expect(sentBody()).not.toHaveProperty("form")
    stream.close()
  })

  it("sends the open form's values with the message", async () => {
    const { formId } = liveForm()
    const stream = openStream([["done", { reply: "ok", tool_events: [] }]])
    const { result } = renderHook(() => useVendorAgent())
    await act(async () => {
      await result.current.send("لأ، خلي السعر 300")
    })
    expect(sentBody().form).toEqual({
      form_id: formId,
      target: "product_create",
      values: { price: 200 },
    })
    stream.close()
  })

  it("sends it with a regenerate too", async () => {
    const { formId } = liveForm()
    openStream([
      ["conversation_ready", { conversation_id: "c1" }],
      ["done", { reply: "ok", tool_events: [] }],
    ])
    const { result, rerender } = renderHook(() => useVendorAgent())
    await act(async () => {
      await result.current.send("hello")
    })
    await waitFor(() => expect(result.current.conversationId).toBe("c1"))
    // A settled render, as a vendor pressing Retry would be looking at.
    rerender()

    openStream([["done", { reply: "again", tool_events: [] }]])
    await act(async () => {
      await result.current.regenerate()
    })
    expect(sentBody()).toMatchObject({
      conversation_id: "c1",
      form: { form_id: formId },
    })
  })

  it("stages a form_patch result into the open form", async () => {
    const { formId, apply } = liveForm()
    const { result, stream } = await start(
      [
        ["tool_start", { name: "patch_form", args: {}, call_id: "p1" }],
        [
          "tool_result",
          {
            name: "patch_form",
            call_id: "p1",
            ok: true,
            result: {
              ok: true,
              form_patch: {
                patch_id: "patch-1",
                form_id: formId,
                target: "product_create",
                values: { price: 300 },
                changed: [{ field: "price", from: 200, to: 300 }],
              },
            },
          },
        ],
      ],
      1,
    )

    await waitFor(() => expect(apply).toHaveBeenCalledWith({ price: 300 }))
    expect(useLiveFormStore.getState().outcomes["patch-1"]).toBe("applied")
    expect(streamingTools(result)[0].result).toMatchObject({
      form_patch: { patch_id: "patch-1" },
    })
    act(() => stream.close())
  })

  it("does not apply a refused patch", async () => {
    const { apply } = liveForm()
    const { stream } = await start(
      [
        ["tool_start", { name: "patch_form", args: {}, call_id: "p1" }],
        [
          "tool_result",
          {
            name: "patch_form",
            call_id: "p1",
            ok: false,
            result: { ok: false, error: "nope" },
            error: "nope",
          },
        ],
      ],
      1,
    )
    expect(apply).not.toHaveBeenCalled()
    act(() => stream.close())
  })
})

/**
 * Retry. It drops the last answer and streams a new one in its place.
 *
 * Whether there was an answer to drop used to be learned inside the
 * `setMessages` updater, from a flag read right after the call — which only
 * holds while React runs the updater eagerly, and it does not when another
 * update to the hook is already queued.
 */
describe("useVendorAgent — regenerate", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "token", isAuthenticated: true })
    useActiveShopStore.setState({ slug: "acme" })
    localStorage.clear()
    useVendorAgentPrefillStore.setState({ pending: {} })
    useLiveFormStore.setState({ current: null, outcomes: {} })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** A thread with one exchange in it, settled as a vendor would see it. */
  async function answered() {
    openStream([
      ["conversation_ready", { conversation_id: "c1" }],
      ["done", { reply: "first", tool_events: [] }],
    ])
    const hook = renderHook(() => useVendorAgent())
    await act(async () => {
      await hook.result.current.send("hello")
    })
    await waitFor(() => expect(hook.result.current.conversationId).toBe("c1"))
    hook.rerender()
    return hook
  }

  const fetchCalls = () =>
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls

  it("replaces the last answer with the new one", async () => {
    const { result } = await answered()
    openStream([["done", { reply: "again", tool_events: [] }]])
    await act(async () => {
      await result.current.regenerate()
    })
    expect(String(fetchCalls()[0][0])).toContain("/chat/regenerate/stream")
    expect(result.current.messages.map((m) => m.content)).toEqual([
      "hello",
      "again",
    ])
  })

  it("still runs when React defers the update", async () => {
    const { result } = await answered()
    openStream([["done", { reply: "again", tool_events: [] }]])
    await act(async () => {
      // Queued first, so the regenerate's own update is not computed eagerly.
      result.current.appendMessage({
        id: "receipt-1",
        role: "assistant",
        content: "Saved.",
        created_at: "2026-10-01T00:00:00.000Z",
      })
      await result.current.regenerate()
    })
    expect(fetchCalls()).toHaveLength(1)
    // The answer the vendor retried is the one that went — not the row that
    // arrived in the same tick.
    expect(result.current.messages.map((m) => m.content)).toEqual([
      "hello",
      "Saved.",
      "again",
    ])
  })

  it("does nothing when the last turn is not an answer", async () => {
    const { result } = await answered()
    act(() => {
      result.current.appendMessage({
        id: "u-2",
        role: "user",
        content: "one more",
        created_at: "2026-10-01T00:00:00.000Z",
      })
    })
    openStream([["done", { reply: "unused", tool_events: [] }]])
    await act(async () => {
      await result.current.regenerate()
    })
    expect(fetchCalls()).toHaveLength(0)
    expect(result.current.messages.map((m) => m.content)).toEqual([
      "hello",
      "first",
      "one more",
    ])
  })
})
