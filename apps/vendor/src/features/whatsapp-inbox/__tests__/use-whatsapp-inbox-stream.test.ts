import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useAuthStore } from "@/shared/stores/auth"
import { WHATSAPP_INBOX_TICKET } from "../api"
import { useWhatsAppInboxStream } from "../use-whatsapp-inbox-stream"

const { client, reconnectDelayMs } = vi.hoisted(() => ({
  client: { mutate: vi.fn() },
  reconnectDelayMs: vi.fn((attempt: number) => 1000 * 2 ** attempt),
}))

vi.mock("@apollo/client/react", () => ({ useApolloClient: () => client }))
vi.mock("@/shared/lib/apollo/links", () => ({
  GRAPHQL_URL: "http://api.test/graphql",
}))
vi.mock("../../notifications/lib/backoff", () => ({ reconnectDelayMs }))

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

  error() {
    this.onerror?.(new Event("error"))
  }
}

describe("useWhatsAppInboxStream", () => {
  const token = "tok_test_123"

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("EventSource", FakeEventSource)
    FakeEventSource.instances = []
    FakeEventSource.throwOnConstruct = false
    useAuthStore.setState({ accessToken: token })
    client.mutate.mockResolvedValue({
      data: {
        whatsAppInboxTicket: {
          success: true,
          data: { ticket: "tkt_one_shot", expires_at: "2026-09-09T12:00:00Z" },
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("mints a ticket and opens the EventSource on mount", async () => {
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppInboxStream(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    expect(client.mutate).toHaveBeenCalledWith({
      mutation: WHATSAPP_INBOX_TICKET,
      fetchPolicy: "no-cache",
      context: { silentErrors: true },
    })

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toBe(
      "http://api.test/whatsapp/inbox/stream?ticket=tkt_one_shot",
    )
  })

  it("dispatches inbox_event to callback", async () => {
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppInboxStream(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const source = FakeEventSource.instances[0]!
    source.open()

    act(() => {
      source.emit({ type: "inbox_event", shop_id: "s1", conversation_id: "c1" })
    })

    expect(onEvent).toHaveBeenCalledWith({
      type: "inbox_event",
      shop_id: "s1",
      conversation_id: "c1",
    })
  })

  it("reconnects on error with backoff and a fresh ticket", async () => {
    const onEvent = vi.fn()
    renderHook(() => useWhatsAppInboxStream(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const source1 = FakeEventSource.instances[0]!
    source1.open()

    // Second ticket on reconnect
    client.mutate.mockResolvedValueOnce({
      data: {
        whatsAppInboxTicket: {
          success: true,
          data: { ticket: "tkt_second", expires_at: "2026-09-09T12:01:00Z" },
        },
      },
    })

    act(() => {
      source1.error()
    })

    expect(source1.close).toHaveBeenCalled()

    // Fast-forward backoff delay
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[1]!.url).toBe(
      "http://api.test/whatsapp/inbox/stream?ticket=tkt_second",
    )
  })

  it("closes EventSource on unmount", async () => {
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useWhatsAppInboxStream(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const source = FakeEventSource.instances[0]!
    unmount()

    expect(source.close).toHaveBeenCalled()
  })
})
