import { describe, expect, it } from "vitest"

import { config } from "@/proxy"
import { routeDecision } from "@/shared/auth/route-access"

/**
 * `/payment-fees` against the route guard.
 *
 * A route absent from `proxy.ts`'s matcher is never seen by the guard at all:
 * it renders for a logged-out visitor instead of redirecting to /login, and
 * nothing about the screen itself would show it. This screen changes a number
 * on every shop, so its entry is pinned rather than assumed.
 */

/** Next's matcher syntax, reduced to the two shapes this console uses. */
function toRegExp(pattern: string): RegExp {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const wildcard = "/:path*"
  return pattern.endsWith(wildcard)
    ? new RegExp(`^${escape(pattern.slice(0, -wildcard.length))}(?:/.*)?$`)
    : new RegExp(`^${escape(pattern)}$`)
}

const covered = (pathname: string) =>
  config.matcher.some((pattern) => toRegExp(pattern).test(pathname))

describe("proxy matcher — /payment-fees", () => {
  it("is seen by the guard, with anything nested under it", () => {
    expect(covered("/payment-fees")).toBe(true)
    expect(covered("/payment-fees/anything")).toBe(true)
  })

  it("matches on segments, so a look-alike path is not covered by accident", () => {
    expect(covered("/payment-feesomething")).toBe(false)
  })

  it("bounces a logged-out visitor off it, keeping where they were headed", () => {
    expect(
      routeDecision({
        pathname: "/payment-fees",
        token: undefined,
        expired: false,
      }),
    ).toEqual({
      type: "redirect",
      to: "/login?redirect=%2Fpayment-fees",
      clearCookies: false,
    })
  })
})
