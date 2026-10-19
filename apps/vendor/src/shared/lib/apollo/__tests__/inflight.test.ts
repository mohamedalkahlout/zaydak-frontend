import { describe, it, expect, afterEach, vi } from "vitest"
import { ApolloLink, gql } from "@apollo/client"
import { Subject } from "rxjs"
import { createInflightTracker } from "../inflight"

/**
 * The tracker is the thing that lets a shop switch wait for what is already
 * out before it clears the cache, so the only property that matters is that
 * the count comes back to zero on *every* way a subscription can end. The
 * unsubscribe case is the one worth pinning: a screen leaving mid-fetch drops
 * its subscription with no result, and a counter that ignored that would sit
 * out the full settle cap on every switch from then on.
 */

const QUERY = gql`
  query Ping {
    ping
  }
`

const EXECUTE_CONTEXT = { client: {} } as never

/** Drive the tracker with a terminating link we control from the test. */
function chainOver(source: Subject<unknown>) {
  const tracker = createInflightTracker()
  const link = tracker.link.concat(
    new ApolloLink(() => source.asObservable() as never),
  )
  return { tracker, link }
}

function run(link: ApolloLink) {
  return ApolloLink.execute(link, { query: QUERY }, EXECUTE_CONTEXT).subscribe({
    next: () => {},
    error: () => {},
    complete: () => {},
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe("createInflightTracker", () => {
  it("counts an operation for as long as it is subscribed", () => {
    const source = new Subject<unknown>()
    const { tracker, link } = chainOver(source)

    expect(tracker.pending()).toBe(0)
    const sub = run(link)
    expect(tracker.pending()).toBe(1)

    source.complete()
    expect(tracker.pending()).toBe(0)
    sub.unsubscribe()
    expect(tracker.pending()).toBe(0)
  })

  it("releases on error", () => {
    const source = new Subject<unknown>()
    const { tracker, link } = chainOver(source)

    run(link)
    expect(tracker.pending()).toBe(1)
    source.error(new Error("network down"))
    expect(tracker.pending()).toBe(0)
  })

  it("releases on an unsubscribe before the operation settles", () => {
    const source = new Subject<unknown>()
    const { tracker, link } = chainOver(source)

    const sub = run(link)
    expect(tracker.pending()).toBe(1)
    sub.unsubscribe()
    expect(tracker.pending()).toBe(0)
  })

  it("resolves waitForIdle straight away when nothing is in flight", async () => {
    const { tracker } = chainOver(new Subject<unknown>())
    await expect(tracker.waitForIdle(1500)).resolves.toBeUndefined()
  })

  it("resolves waitForIdle when the last operation settles", async () => {
    const first = new Subject<unknown>()
    const tracker = createInflightTracker()
    const link = tracker.link.concat(
      new ApolloLink(() => first.asObservable() as never),
    )

    run(link)
    run(link)
    expect(tracker.pending()).toBe(2)

    let settled = false
    const idle = tracker.waitForIdle(1500).then(() => {
      settled = true
    })

    first.complete()
    await idle
    expect(settled).toBe(true)
    expect(tracker.pending()).toBe(0)
  })

  it("resolves at the cap when an operation never settles", async () => {
    vi.useFakeTimers()
    const source = new Subject<unknown>()
    const { tracker, link } = chainOver(source)

    run(link)
    const idle = tracker.waitForIdle(1500)

    await vi.advanceTimersByTimeAsync(1500)
    await expect(idle).resolves.toBeUndefined()
    // The cap resolves the wait; it does not pretend the request finished.
    expect(tracker.pending()).toBe(1)
  })
})
