import { beforeEach, expect, it, vi } from "vitest"
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from "@apollo/client"
import { ApolloProvider } from "@apollo/client/react"
import { renderHook } from "@testing-library/react"

import { useAdoptRetry } from "../use-adopt-retry"

const consumePending = vi.hoisted(() => vi.fn())
const adopt = vi.hoisted(() => vi.fn())
const getCookie = vi.hoisted(() => vi.fn())

vi.mock("@/features/cart/adopt-guest-cart", () => ({
  consumePendingAdopt: consumePending,
  adoptGuestCart: adopt,
}))

vi.mock("@/shared/lib/use-shop-slug", () => ({
  useShopSlug: () => "acme",
}))

vi.mock("@/shared/lib/cookies", () => ({
  getCookie: getCookie,
}))

/**
 * `useAdoptRetry` — the one second chance a failed guest→user merge gets on a
 * page load.
 *
 * The hook is bounded by two gates and a one-shot flag: it only fires when a
 * retry is actually owed (the flag `consumePendingAdopt` reads-and-clears), and
 * only when the shop holds a session. The signed-in gate reads the access
 * cookie rather than the auth store, because at effect time the store may not
 * have hydrated for this shop yet — and the cookie is exactly what the Apollo
 * link will send, so it is the honest "would `syncCart` be accepted" check.
 */

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(
      () =>
        new Observable((observer) => {
          observer.next({ data: null })
          observer.complete()
        }),
    ),
  })
  return <ApolloProvider client={client}>{children}</ApolloProvider>
}

beforeEach(() => {
  consumePending.mockReset()
  adopt.mockReset()
  getCookie.mockReset()
})

it("attempts the merge once when a retry is owed and the shop holds a session", () => {
  consumePending.mockReturnValue(true)
  getCookie.mockReturnValue("tok")

  renderHook(() => useAdoptRetry(), { wrapper })

  expect(adopt).toHaveBeenCalledTimes(1)
})

it("does not attempt a merge when no retry is owed", () => {
  consumePending.mockReturnValue(false)
  getCookie.mockReturnValue("tok")

  renderHook(() => useAdoptRetry(), { wrapper })

  expect(consumePending).toHaveBeenCalledTimes(1)
  expect(adopt).not.toHaveBeenCalled()
})

it("drops a retry owed to a signed-out visitor rather than attempt it", () => {
  // A later sign-in runs `adoptGuestCart` itself and re-arms from its result,
  // so a flag left by an earlier failure has no debt to honour without a
  // session — and sending `syncCart` unauthenticated is a guaranteed rejection.
  consumePending.mockReturnValue(true)
  getCookie.mockReturnValue(null)

  renderHook(() => useAdoptRetry(), { wrapper })

  expect(adopt).not.toHaveBeenCalled()
})