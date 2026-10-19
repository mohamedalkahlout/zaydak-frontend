import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { WHATSAPP_QR_TICKET } from "../api"
import { useWhatsAppQrStream } from "../use-whatsapp-qr-stream"
import type { WhatsAppStreamEvent } from "../types"

const { client, reconnectDelayMs } = vi.hoisted(() => ({
  client: { mutate: vi.fn() },
  reconnectDelayMs: vi.fn((attempt: number) => 1000 * 2 ** attempt),
}))

vi.mock("@apollo/client/react", () => ({ useApolloClient: () => client }))
vi.mock("@/shared/lib/apollo/links", () => ({
  GRAPHQL_URL: "http://api.test/graphql",
}))
vi.mock("@/features/notifications/lib/backoff", () => ({ reconnectDelayMs }))

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static throwOnConstruct = false

  readonly url: string
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  close = vi.fn()

  constructor(url: string) {
    if (FakeEventSource.throwOnConstruct) throw new Error("bad url")
    this.url = url
    FakeEventSource.instances.push(this)
  }

  open() {
    this.onopen?.(new Event("open"))
  }

  emit(data: unknown) {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    } as MessageEvent)
  }

  fail() {
    this.onerror?.(new Event("error"))
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

function ticketPayload(ticket: string) {
  return {
    data: {
      whatsAppQrTicket: {
        success: true,
        data: { ticket, expires_in: 30 },
      },
    },
  }
}

const ticketOk = (ticket = "t-1") =>
  client.mutate.mockResolvedValueOnce(ticketPayload(ticket))

const ticketFail = (err = new Error("network")) =>
  client.mutate.mockRejectedValueOnce(err)

const instances = () => FakeEventSource.instances
const latestSource = () => {
  const list = FakeEventSource.instances
  return list[list.length - 1]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal("EventSource", FakeEventSource)
  FakeEventSource.instances = []
  FakeEventSource.throwOnConstruct = false
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("useWhatsAppQrStream", () => {
  it("does nothing when enabled is false", () => {
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: false, onEvent }))

    expect(client.mutate).not.toHaveBeenCalled()
    expect(instances()).toHaveLength(0)
  })

  it("requests a ticket and connects to the stream when enabled", async () => {
    ticketOk("qr-ticket-123")
    const onEvent = vi.fn()

    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))

    expect(client.mutate).toHaveBeenCalledWith({
      mutation: WHATSAPP_QR_TICKET,
      fetchPolicy: "no-cache",
      context: { silentErrors: true },
    })

    await act(async () => {})

    expect(instances()).toHaveLength(1)
    expect(latestSource()?.url).toBe(
      "http://api.test/whatsapp/qr/stream?ticket=qr-ticket-123",
    )
  })

  it("forwards parsed stream events to onEvent", async () => {
    ticketOk("t-frame")
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))
    await act(async () => {})

    const frame: WhatsAppStreamEvent = {
      type: "qr",
      qr: "data:image/png;base64,abc",
    }
    act(() => {
      latestSource()?.emit(frame)
    })

    expect(onEvent).toHaveBeenCalledWith(frame)
  })

  it("safely ignores non-JSON frames", async () => {
    ticketOk("t-nonjson")
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))
    await act(async () => {})

    act(() => {
      latestSource()?.emit("invalid-json{")
    })

    expect(onEvent).not.toHaveBeenCalled()
  })

  it("surfaces error to onEvent and schedules reconnect when ticket minting fails", async () => {
    ticketFail()
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))
    await act(async () => {})

    expect(onEvent).toHaveBeenCalledWith({ type: "error", message: "stream" })
    expect(reconnectDelayMs).toHaveBeenCalledWith(0)
    expect(instances()).toHaveLength(0)

    // Second attempt succeeds
    ticketOk("t-recovered")
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(instances()).toHaveLength(1)
    expect(latestSource()?.url).toContain("t-recovered")
  })

  it("surfaces error when ticket is returned empty", async () => {
    client.mutate.mockResolvedValueOnce({
      data: { whatsAppQrTicket: { success: true, data: { ticket: "" } } },
    })
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))
    await act(async () => {})

    expect(onEvent).toHaveBeenCalledWith({ type: "error", message: "stream" })
    expect(reconnectDelayMs).toHaveBeenCalledWith(0)
    expect(instances()).toHaveLength(0)
  })

  it("reconnects with a fresh ticket when EventSource fires onerror", async () => {
    ticketOk("t-err-1")
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent }))
    await act(async () => {})

    const firstSource = latestSource()
    ticketOk("t-err-2")

    act(() => {
      firstSource?.fail()
    })

    expect(firstSource?.close).toHaveBeenCalled()
    expect(reconnectDelayMs).toHaveBeenCalledWith(0)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(instances()).toHaveLength(2)
    expect(latestSource()?.url).toContain("t-err-2")
  })

  it("resets backoff attempt counter when stream opens", async () => {
    ticketOk("t-open")
    renderHook(() => useWhatsAppQrStream({ enabled: true, onEvent: vi.fn() }))
    await act(async () => {})

    const source = latestSource()
    act(() => {
      source?.open()
    })

    // Now fail — attempt counter should start at 0
    ticketOk("t-after-open")
    act(() => {
      source?.fail()
    })

    expect(reconnectDelayMs).toHaveBeenCalledWith(0)
  })

  it("closes EventSource and cancels retry on unmount", async () => {
    ticketOk("t-unmount")
    const { unmount } = renderHook(() =>
      useWhatsAppQrStream({ enabled: true, onEvent: vi.fn() }),
    )
    await act(async () => {})

    const source = latestSource()
    unmount()

    expect(source?.close).toHaveBeenCalled()
  })

  it("drops a ticket that resolves after unmount", async () => {
    const { promise, resolve } = deferred<any>()
    client.mutate.mockReturnValueOnce(promise)

    const { unmount } = renderHook(() =>
      useWhatsAppQrStream({ enabled: true, onEvent: vi.fn() }),
    )

    unmount()

    await act(async () => {
      resolve(ticketPayload("late-ticket"))
    })

    expect(instances()).toHaveLength(0)
  })

  it("uses the latest callback without reconnecting", async () => {
    ticketOk("t-latest-cb")
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    const { rerender } = renderHook(
      ({ onEvent }) => useWhatsAppQrStream({ enabled: true, onEvent }),
      { initialProps: { onEvent: cb1 } },
    )
    await act(async () => {})

    rerender({ onEvent: cb2 })

    // Still only 1 connection
    expect(client.mutate).toHaveBeenCalledTimes(1)
    expect(instances()).toHaveLength(1)

    const frame: WhatsAppStreamEvent = { type: "connected" }
    act(() => {
      latestSource()?.emit(frame)
    })

    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledWith(frame)
  })
})
