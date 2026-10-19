import { StrictMode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"

import {
  REMINDER_LINK_PARAM,
  useReminderLinkOpen,
} from "../use-reminder-link-open"
import { RECORD_CART_LINK_OPEN } from "../api"
import { useAuthStore, EMPTY_SESSION } from "@/shared/stores/auth"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"

const mutate = vi.hoisted(() => vi.fn())

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ mutate }),
}))

/**
 * `useReminderLinkOpen` — the cart page's report that a shopper clicked a
 * recovery reminder's signed `?rc=` link.
 *
 * Three promises: it sends the token exactly once, it takes the token out of
 * the address bar (and nothing else), and a refusal never reaches the shopper.
 * When the shopper is signed out, it prompts them to sign in so their account's
 * cart loads.
 */

function visit(path: string) {
  window.history.replaceState(null, "", path)
}

beforeEach(() => {
  mutate.mockReset()
  mutate.mockResolvedValue({ data: { recordCartLinkOpen: { success: true } } })
  useAuthDialogStore.setState({ stack: [], redirect: null })
  useAuthStore.setState({ sessions: {}, hydrated: false, hydratedFor: null })
})

afterEach(() => {
  cleanup()
  visit("/")
  useAuthDialogStore.setState({ stack: [], redirect: null })
  useAuthStore.setState({ sessions: {}, hydrated: false, hydratedFor: null })
})

it("keeps the parameter name the back-end signs links with", () => {
  expect(REMINDER_LINK_PARAM).toBe("rc")
})

it("sends the token and strips it from the URL, keeping everything else", () => {
  visit("/acme/cart?utm_source=email&rc=cart-1.abcdefghijklmnop#summary")

  renderHook(() => useReminderLinkOpen())

  expect(mutate).toHaveBeenCalledTimes(1)
  expect(mutate).toHaveBeenCalledWith({
    mutation: RECORD_CART_LINK_OPEN,
    variables: { token: "cart-1.abcdefghijklmnop" },
  })
  expect(window.location.pathname).toBe("/acme/cart")
  expect(window.location.search).toBe("?utm_source=email")
  expect(window.location.hash).toBe("#summary")
})

it("fires once under Strict Mode's double mount", () => {
  visit("/acme/cart?rc=cart-1.abcdefghijklmnop")

  renderHook(() => useReminderLinkOpen(), { wrapper: StrictMode })

  expect(mutate).toHaveBeenCalledTimes(1)
  expect(window.location.search).toBe("")
})

it("does not fire again on a later mount once the token is gone", () => {
  visit("/cart?rc=cart-1.abcdefghijklmnop")

  renderHook(() => useReminderLinkOpen()).unmount()
  renderHook(() => useReminderLinkOpen())

  expect(mutate).toHaveBeenCalledTimes(1)
})

it("does nothing on an ordinary visit to the cart", () => {
  visit("/acme/cart?utm_source=email")

  renderHook(() => useReminderLinkOpen())

  expect(mutate).not.toHaveBeenCalled()
  expect(window.location.search).toBe("?utm_source=email")
})

it("swallows a refused token rather than surface it to the shopper", async () => {
  mutate.mockRejectedValue(new Error("This cart link is not valid for this shop"))
  visit("/acme/cart?rc=forged.AAAAAAAAAAAAAAAA")

  renderHook(() => useReminderLinkOpen())

  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
  // The rejection is handled inside the hook; an unhandled one fails the run.
  await Promise.resolve()
  expect(window.location.search).toBe("")
})

it("prompts a signed-out visitor to sign in when arriving with a reminder link", async () => {
  useAuthStore.setState({
    sessions: { acme: { ...EMPTY_SESSION, isAuthenticated: false } },
    hydrated: true,
    hydratedFor: "acme",
  })
  visit("/acme/cart?rc=cart-1.abcdefghijklmnop")

  renderHook(() => useReminderLinkOpen())

  await waitFor(() => {
    expect(useAuthDialogStore.getState().stack).toEqual(["login"])
  })
  expect(useAuthDialogStore.getState().redirect).toBe("/acme/cart")
})

it("does not prompt a signed-in visitor arriving with a reminder link", async () => {
  useAuthStore.setState({
    sessions: { acme: { ...EMPTY_SESSION, isAuthenticated: true } },
    hydrated: true,
    hydratedFor: "acme",
  })
  visit("/acme/cart?rc=cart-1.abcdefghijklmnop")

  renderHook(() => useReminderLinkOpen())

  await waitFor(() => {
    expect(mutate).toHaveBeenCalledTimes(1)
  })
  expect(useAuthDialogStore.getState().stack).toEqual([])
})

it("does not prompt on an ordinary visit when signed out", () => {
  useAuthStore.setState({
    sessions: { acme: { ...EMPTY_SESSION, isAuthenticated: false } },
    hydrated: true,
    hydratedFor: "acme",
  })
  visit("/acme/cart")

  renderHook(() => useReminderLinkOpen())

  expect(useAuthDialogStore.getState().stack).toEqual([])
})
