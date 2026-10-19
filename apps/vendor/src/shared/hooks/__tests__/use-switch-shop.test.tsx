import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { ApolloLink, gql } from "@apollo/client"
import { Subject } from "rxjs"
import { createInflightTracker, registerInflightTracker } from "@/shared/lib/apollo/inflight"

/**
 * What these pin is an *order*, because getting it wrong is invisible until
 * production: writing the active-shop store before the link chain is idle is
 * the crash this hook exists to remove, and pushing before that write sends
 * the new page's first request out under the previous shop's `X-SHOP`.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); the in-flight tracker is the real one, driven by a link the
 * test controls.
 */

const calls: string[] = []
const push = vi.fn((href: string) => calls.push(`push:${href}`))
const replace = vi.fn((href: string) => calls.push(`replace:${href}`))
const setSlug = vi.fn((slug: string) => calls.push(`setSlug:${slug}`))

let currentSlug: string | null = "acme"
let client: object = {}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
}))

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => client,
}))

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: (
    select: (state: { slug: string | null; setSlug: (s: string) => void }) => unknown,
  ) => select({ slug: currentSlug, setSlug }),
}))

const { useSwitchShop } = await import("../use-switch-shop")

const QUERY = gql`
  query Ping {
    ping
  }
`

/** A real tracker with one operation held open, bound to a fresh client. */
function trackerWithPendingOperation() {
  const source = new Subject<unknown>()
  const tracker = createInflightTracker()
  const link = tracker.link.concat(
    new ApolloLink(() => source.asObservable() as never),
  )
  const boundClient = {}
  registerInflightTracker(boundClient, tracker)
  ApolloLink.execute(link, { query: QUERY }, { client: {} } as never).subscribe({
    next: () => {},
    error: () => {},
    complete: () => {},
  })
  return { source, tracker, client: boundClient }
}

beforeEach(() => {
  calls.length = 0
  push.mockClear()
  replace.mockClear()
  setSlug.mockClear()
  currentSlug = "acme"
  client = {}
})

describe("useSwitchShop", () => {
  it("writes the active shop before it navigates", async () => {
    const { result } = renderHook(() => useSwitchShop())
    await act(async () => {
      await result.current("beta")
    })
    expect(calls).toEqual(["setSlug:beta", "push:/store/beta"])
  })

  it("navigates without touching the store when the shop is already active", async () => {
    const { result } = renderHook(() => useSwitchShop())
    await act(async () => {
      await result.current("acme")
    })
    expect(setSlug).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/store/acme")
  })

  it("honours an explicit href and replace", async () => {
    const { result } = renderHook(() => useSwitchShop())
    await act(async () => {
      await result.current("beta", {
        href: "/store/beta/settings/domains",
        replace: true,
      })
    })
    expect(calls).toEqual([
      "setSlug:beta",
      "replace:/store/beta/settings/domains",
    ])
    expect(push).not.toHaveBeenCalled()
  })

  it("holds the switch until the link chain goes idle", async () => {
    const pending = trackerWithPendingOperation()
    client = pending.client

    const { result } = renderHook(() => useSwitchShop())
    let settled = false
    let switched: Promise<void>
    await act(async () => {
      switched = result.current("beta").then(() => {
        settled = true
      })
      // Still in flight: nothing may be written yet, because the write is what
      // clears the cache and cancels the request that is still out.
      await Promise.resolve()
    })
    expect(settled).toBe(false)
    expect(setSlug).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()

    await act(async () => {
      pending.source.complete()
      await switched!
    })
    expect(calls).toEqual(["setSlug:beta", "push:/store/beta"])
  })
})
