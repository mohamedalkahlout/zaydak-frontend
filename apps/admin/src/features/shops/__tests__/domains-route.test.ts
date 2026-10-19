import { describe, expect, it } from "vitest"

import { config } from "@/proxy"
import { routeDecision } from "@/shared/auth/route-access"

/**
 * `/shops/[shopId]/domains` against the route guard.
 *
 * A route absent from `proxy.ts`'s matcher is never seen by the guard at all —
 * it renders for a logged-out visitor instead of redirecting to /login, and
 * nothing about the screen itself would show it. `"/shops/:path*"` already
 * covers the nested route, so this change adds no matcher entry; that is worth
 * pinning rather than assuming, because the next nested screen under a segment
 * that is listed *without* `:path*` would silently be unguarded.
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

describe("proxy matcher", () => {
  it("already covers the nested domains route", () => {
    expect(covered("/shops")).toBe(true)
    expect(covered("/shops/shop-1/domains")).toBe(true)
  })

  it("matches on segments, so the converter is not passing everything", () => {
    expect(covered("/shopsomething")).toBe(false)
    expect(covered("/not-a-console-route")).toBe(false)
  })

  it("bounces a logged-out visitor off it, keeping where they were headed", () => {
    expect(
      routeDecision({
        pathname: "/shops/shop-1/domains",
        token: undefined,
        expired: false,
      }),
    ).toEqual({
      type: "redirect",
      to: "/login?redirect=%2Fshops%2Fshop-1%2Fdomains",
      clearCookies: false,
    })
  })
})
