import { ApolloLink } from "@apollo/client"
import { Observable } from "rxjs"

/**
 * How long a shop switch will hold for the requests already out.
 *
 * A cap rather than an open wait: one operation wedged behind a dead
 * connection must not be able to stop the vendor changing store. Past it the
 * cache is cleared anyway and `ShopSwitchBoundary` absorbs whatever the clear
 * cancels.
 */
export const SHOP_SWITCH_SETTLE_MS = 1500

export interface InflightTracker {
  /**
   * Put this at the *head* of the chain so it wraps every other link and sees
   * an operation for as long as it is anywhere in flight.
   */
  link: ApolloLink
  /** Operations currently subscribed in the link chain. */
  pending: () => number
  /**
   * Resolves once nothing is in flight, or after `timeoutMs` — whichever
   * comes first. Resolves synchronously-ish (a already-settled promise) when
   * the chain is idle.
   */
  waitForIdle: (timeoutMs: number) => Promise<void>
}

/**
 * Counts the operations currently moving through the link chain.
 *
 * It exists for exactly one caller: `useSwitchShop`, which must not write the
 * active-shop store while a request is still out. `ShopCacheBoundary` watches
 * that store and answers a change with `client.clearStore()`, and Apollo's
 * `clearStore` rejects every pending fetch with the invariant "Store reset
 * while query was in flight". That rejection is minted by the QueryManager
 * rather than sent through the link chain, so `makeErrorLink` never sees it —
 * it lands on whoever was reading the query, and for a `useSuspenseQuery` that
 * means thrown at render, i.e. an error page. Waiting for idle first is what
 * removes the race rather than dressing it up.
 *
 * Not module-global: `makeClient` also runs during SSR under
 * `ApolloNextAppProvider`, and every browser tab gets its own client. The
 * tracker is registered against its client in a `WeakMap` instead.
 */
export function createInflightTracker(): InflightTracker {
  let count = 0
  const waiters = new Set<() => void>()

  function release() {
    count = Math.max(0, count - 1)
    if (count > 0) return
    // Copy before running: a waiter is free to start another operation.
    const settling = [...waiters]
    waiters.clear()
    for (const settle of settling) settle()
  }

  const link = new ApolloLink(
    (operation, forward) =>
      new Observable<ApolloLink.Result>((subscriber) => {
        count += 1
        let counted = true
        const inner = forward(operation).subscribe(subscriber)

        // rxjs runs this teardown exactly once per subscription — on complete,
        // on error, and on an unsubscribe before either. The unsubscribe case
        // is the one that matters: a screen leaving mid-fetch drops its
        // `useQuery` subscription with no result, and a counter that ignored
        // it would never return to zero, so every later switch would sit out
        // the full cap.
        return () => {
          if (counted) {
            counted = false
            release()
          }
          inner.unsubscribe()
        }
      }),
  )

  function waitForIdle(timeoutMs: number): Promise<void> {
    if (count === 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const settle = () => {
        clearTimeout(timer)
        waiters.delete(settle)
        resolve()
      }
      waiters.add(settle)
      const timer = setTimeout(settle, timeoutMs)
    })
  }

  return { link, pending: () => count, waitForIdle }
}

const trackers = new WeakMap<object, InflightTracker>()

/** Bind a tracker to the client whose chain it was installed in. */
export function registerInflightTracker(
  client: object,
  tracker: InflightTracker,
): void {
  trackers.set(client, tracker)
}

/** The tracker for `client`, or undefined for a client that carries none. */
export function inflightTrackerOf(
  client: object | null | undefined,
): InflightTracker | undefined {
  return client ? trackers.get(client) : undefined
}
