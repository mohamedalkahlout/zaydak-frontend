import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useAuthStore } from "@/shared/stores/auth"
import { NOTIFICATION_STREAM_TICKET } from "../api"
import { useNotificationsStream } from "../use-notifications-stream"

/**
 * The stream hook has three jobs and each is a place a regression would be
 * silent in production, because every failure path is deliberately swallowed
 * (the 60s poll is the correctness backstop):
 *
 *  1. the ticket handshake — a one-shot ticket is minted over GraphQL and spent
 *     on the stream URL, never the access token itself;
 *  2. the EventSource lifecycle — frames reach the callback, errors close the
 *     source and re-handshake with a FRESH ticket on our own backoff, and an
 *     open stream resets that backoff;
 *  3. cleanup — unmounting (or a token change) closes the source, cancels a
 *     pending retry, and drops a ticket that resolves after the fact.
 *
 * Neither jsdom nor Node ships an `EventSource`, so one is stubbed in per test.
 * Without it `new EventSource` throws inside the hook's own try/catch, which
 * schedules a reconnect and makes every assertion below fail confusingly.
 *
 * `reconnectDelayMs` is mocked to a jitter-free `1000 * 2 ** attempt` so the
 * tests can assert the attempt counter; `lib/__tests__/backoff.test.ts` is
 * where the real delay math is pinned.
 */

// `vi.mock` is hoisted above the imports, so anything its factories reference
// has to be hoisted with it.
const { client, reconnectDelayMs } = vi.hoisted(() => ({
  client: { mutate: vi.fn() },
  reconnectDelayMs: vi.fn((attempt: number) => 1000 * 2 ** attempt),
}))

// One stable object: the hook's effect depends on `[token, client]`, so a
// fresh client per render would resubscribe every render and mask the
// latest-callback test.
vi.mock("@apollo/client/react", () => ({ useApolloClient: () => client }))
// The hook derives its REST base from this; pinning it keeps the URL
// assertion independent of a developer's `NEXT_PUBLIC_GRAPHQL_URL`.
vi.mock("@/shared/lib/apollo/links", () => ({
  GRAPHQL_URL: "http://api.test/graphql",
}))
vi.mock("../lib/backoff", () => ({ reconnectDelayMs }))

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

  /** A server frame; objects are serialised the way the real stream does. */
  emit(data: unknown) {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    } as MessageEvent)
  }

  fail() {
    this.onerror?.(new Event("error"))
  }
}

/** A promise whose settling is decided by the test, not by a microtask. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  // The rejection path is always claimed; an unhandled one fails the run.
  promise.catch(() => {})
  return { promise, resolve, reject }
}

function ticketPayload(ticket: string) {
  return {
    data: {
      notificationStreamTicket: { success: true, ticket, expires_in: 30 },
    },
  }
}

const ticketOk = (ticket = "t-1") =>
  client.mutate.mockResolvedValueOnce(ticketPayload(ticket))
const ticketFails = () =>
  client.mutate.mockRejectedValueOnce(new Error("network"))

/** Let the awaited `mutate` inside `connect()` settle and the source mount. */
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })

/** Fire a reconnect timer. Must be the async variant: its callback awaits. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const signIn = (token = "tok") =>
  act(() => {
    useAuthStore.setState({ accessToken: token })
  })

const instances = () => FakeEventSource.instances
const latest = () => {
  const list = FakeEventSource.instances
  return list[list.length - 1]
}

function mount(onNotification: () => void = vi.fn()) {
  return renderHook(({ cb }: { cb: () => void }) => useNotificationsStream(cb), {
    initialProps: { cb: onNotification },
  })
}

describe("useNotificationsStream", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("EventSource", FakeEventSource)
    client.mutate.mockReset()
    reconnectDelayMs.mockClear()
    FakeEventSource.instances = []
    FakeEventSource.throwOnConstruct = false
    useAuthStore.setState({ accessToken: null })
    document.cookie = "access_token=; max-age=0"
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe("ticket handshake", () => {
    it("does nothing without a token in the store or the cookie", async () => {
      mount()
      await flush()

      expect(client.mutate).not.toHaveBeenCalled()
      expect(instances()).toHaveLength(0)
    })

    it("mints a silent, uncached ticket and spends it on the stream URL", async () => {
      // The ticket is URL-encoded into the query string: a token that reads
      // as a path or a space must arrive at the server intact.
      ticketOk("a b/c")
      await signIn()
      mount()
      await flush()

      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(client.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: NOTIFICATION_STREAM_TICKET,
          fetchPolicy: "no-cache",
          context: { silentErrors: true },
        }),
      )
      expect(instances()).toHaveLength(1)
      expect(latest().url).toBe(
        "http://api.test/notifications/stream?ticket=a%20b%2Fc",
      )
    })

    it("falls back to the access-token cookie when the store is empty", async () => {
      document.cookie = "access_token=cookie-tok"
      ticketOk()
      mount()
      await flush()

      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(instances()).toHaveLength(1)
    })

    it("connects once a token arrives after mount", async () => {
      ticketOk()
      mount()
      await flush()
      expect(client.mutate).not.toHaveBeenCalled()

      await signIn()
      await flush()

      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(instances()).toHaveLength(1)
    })

    it("retries a rejected ticket on the exponential schedule", async () => {
      ticketFails()
      ticketFails()
      ticketOk()
      await signIn()
      mount()
      await flush()

      expect(instances()).toHaveLength(0)
      expect(reconnectDelayMs).toHaveBeenLastCalledWith(0)

      await advance(1000)
      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(reconnectDelayMs).toHaveBeenLastCalledWith(1)

      await advance(2000)
      expect(client.mutate).toHaveBeenCalledTimes(3)
      expect(instances()).toHaveLength(1)
    })

    it.each([
      ["an empty ticket", ticketPayload("")],
      ["a payload with no data", { data: undefined }],
    ])("treats %s as a failed handshake and retries", async (_label, payload) => {
      client.mutate.mockResolvedValueOnce(payload)
      ticketOk()
      await signIn()
      mount()
      await flush()

      expect(instances()).toHaveLength(0)
      expect(reconnectDelayMs).toHaveBeenCalledWith(0)

      await advance(1000)
      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(instances()).toHaveLength(1)
    })

    it("retries when the EventSource itself cannot be constructed", async () => {
      ticketOk("t-1")
      ticketOk("t-2")
      FakeEventSource.throwOnConstruct = true
      await signIn()
      mount()
      await flush()

      expect(instances()).toHaveLength(0)
      expect(reconnectDelayMs).toHaveBeenCalledWith(0)

      FakeEventSource.throwOnConstruct = false
      await advance(1000)

      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(instances()).toHaveLength(1)
      expect(latest().url).toContain("ticket=t-2")
    })
  })

  describe("frames", () => {
    it("invokes the callback only for notification frames", async () => {
      const onNotification = vi.fn()
      ticketOk()
      await signIn()
      mount(onNotification)
      await flush()

      // The server's own vocabulary: `connected` on open, `ping` keep-alives,
      // `expired` before it ends the stream, and `notification` per row.
      latest().emit({ type: "connected" })
      latest().emit({ type: "ping" })
      latest().emit({ type: "expired" })
      expect(onNotification).not.toHaveBeenCalled()

      latest().emit({
        type: "notification",
        id: "n1",
        notify_type: "ORDER",
        entity_type: "order",
        entity_id: "o1",
        created_at: "2026-09-08T00:00:00.000Z",
      })
      expect(onNotification).toHaveBeenCalledTimes(1)
    })

    it("ignores a non-JSON frame without throwing", async () => {
      const onNotification = vi.fn()
      ticketOk()
      await signIn()
      mount(onNotification)
      await flush()

      expect(() => latest().emit("not json")).not.toThrow()
      expect(onNotification).not.toHaveBeenCalled()
    })

    it("delivers to the latest callback without resubscribing", async () => {
      const first = vi.fn()
      const second = vi.fn()
      ticketOk()
      await signIn()
      const { rerender } = mount(first)
      await flush()

      rerender({ cb: second })
      latest().emit({ type: "notification", id: "n1" })

      expect(second).toHaveBeenCalledTimes(1)
      expect(first).not.toHaveBeenCalled()
      // Swapping the callback is not a reason to spend another ticket.
      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(instances()).toHaveLength(1)
    })
  })

  describe("reconnect", () => {
    it("closes the source on error and re-handshakes with a fresh ticket", async () => {
      ticketOk("t-1")
      ticketOk("t-2")
      await signIn()
      mount()
      await flush()

      const first = latest()
      first.fail()
      expect(first.close).toHaveBeenCalledTimes(1)
      expect(client.mutate).toHaveBeenCalledTimes(1)

      await advance(1000)

      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(instances()).toHaveLength(2)
      // The spent ticket is never replayed — that is why the browser's own
      // retry is not used here.
      expect(latest().url).toContain("ticket=t-2")
      expect(latest().url).not.toContain("ticket=t-1")
    })

    it("restarts the backoff once a stream has opened", async () => {
      ticketOk()
      ticketOk()
      ticketOk()
      ticketOk()
      await signIn()
      mount()
      await flush()

      // Two streams that never open: the delay grows.
      latest().fail()
      await advance(1000)
      latest().fail()
      await advance(2000)
      expect(reconnectDelayMs.mock.calls.map(([attempt]) => attempt)).toEqual([
        0, 1,
      ])

      // One that opens and then drops: the next delay is from scratch.
      latest().open()
      latest().fail()
      expect(reconnectDelayMs).toHaveBeenLastCalledWith(0)
    })

    it("re-handshakes after the server expires the stream", async () => {
      const onNotification = vi.fn()
      ticketOk("t-1")
      ticketOk("t-2")
      await signIn()
      mount(onNotification)
      await flush()

      // The server ends a stream after a bounded lifetime: an `expired` frame,
      // then completion, which the browser surfaces as an error.
      const first = latest()
      first.emit({ type: "expired" })
      first.fail()
      expect(onNotification).not.toHaveBeenCalled()
      expect(first.close).toHaveBeenCalledTimes(1)

      await advance(1000)

      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(latest().url).toContain("ticket=t-2")
    })
  })

  describe("cleanup", () => {
    it("closes an open stream on unmount and never reconnects", async () => {
      ticketOk()
      await signIn()
      const { unmount } = mount()
      await flush()

      const source = latest()
      unmount()
      expect(source.close).toHaveBeenCalledTimes(1)

      await advance(60_000)
      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(instances()).toHaveLength(1)
    })

    it("drops a ticket that resolves after unmount", async () => {
      const gate = deferred<ReturnType<typeof ticketPayload>>()
      client.mutate.mockReturnValueOnce(gate.promise)
      await signIn()
      const { unmount } = mount()
      await flush()
      expect(client.mutate).toHaveBeenCalledTimes(1)

      unmount()
      gate.resolve(ticketPayload("late"))
      await flush()

      expect(instances()).toHaveLength(0)
      expect(reconnectDelayMs).not.toHaveBeenCalled()
    })

    it("cancels a pending reconnect on unmount", async () => {
      ticketFails()
      await signIn()
      const { unmount } = mount()
      await flush()
      expect(reconnectDelayMs).toHaveBeenCalledTimes(1)

      unmount()
      await advance(60_000)

      expect(client.mutate).toHaveBeenCalledTimes(1)
      expect(instances()).toHaveLength(0)
    })

    it("closes the old stream and opens a new one when the token changes", async () => {
      ticketOk("t-1")
      ticketOk("t-2")
      await signIn("tok-1")
      mount()
      await flush()
      const first = latest()

      await signIn("tok-2")
      await flush()

      expect(first.close).toHaveBeenCalledTimes(1)
      expect(client.mutate).toHaveBeenCalledTimes(2)
      expect(instances()).toHaveLength(2)
      expect(latest().url).toContain("ticket=t-2")
    })
  })
})
