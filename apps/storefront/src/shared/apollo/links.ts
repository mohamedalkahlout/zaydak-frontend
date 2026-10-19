import { HttpLink, type ApolloLink } from "@apollo/client"
import { SetContextLink } from "@apollo/client/link/context"
import { ErrorLink } from "@apollo/client/link/error"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import { from, mergeMap, of } from "rxjs"

import { currentShopSlug, shopPathFor } from "@/shared/lib/shop-scope"
import { sessionAccessToken } from "@/shared/auth/access-token"
import { STOREFRONT_CLIENT_HEADER } from "@/shared/api/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from "@/shared/i18n/config"
import { getCookie } from "@/shared/lib/cookies"
import { GRAPHQL_URL } from "./endpoint"
import { tunnelHeaders } from "./tunnel-headers"

export { GRAPHQL_URL }

/**
 * Apollo links for the customer storefront.
 *
 *  - **session** — `X-SHOP` from the page's shop (`currentShopSlug()`: the
 *    path, the shop hostname, or the shop the proxy resolved a custom domain
 *    to), and that shop's bearer token. Nearly every operation the storefront
 *    calls is behind
 *    `RequireShopGuard`, so an operation that goes out without the header does
 *    not return less data, it *fails*; and most of the app works without a
 *    token, which is the point — browsing and the anonymous cart are
 *    unauthenticated.
 *  - **locale** — `accept-language`, so the back-end's error messages come back
 *    in the language the visitor is reading.
 *
 * **The token and the header are resolved together, in one link, from one read
 * of the slug.** They used to be two independent `SetContextLink`s reading two
 * independent sources, which paired shop A's token with `x-shop: beta` whenever
 * the URL changed between them. That used to be a silent wrong answer; now that
 * a session is bound to one shop server-side, it is a hard rejection — so the
 * two facts have to be decided at the same instant or the mismatch is committed
 * to the wire.
 *
 * There is deliberately **no `x-shop` pin escape hatch**. Nothing in the app
 * pins one, and honouring a pinned value would mean deriving a token from
 * something that may be a shop *id*, finding no cookie under that name, and
 * sending the request anonymously — a silent guest downgrade on every
 * `OptionalJwtGuard` chain.
 */

type HeaderContext = { headers?: Record<string, string> }

const AUTH_ERROR_CODES = new Set([
  "TOKEN_INVALID",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "AUTHENTICATION_REQUIRED",
])

function makeSessionLink() {
  return new SetContextLink((prevContext) => {
    const { headers = {} } = prevContext as HeaderContext
    const slug = currentShopSlug()
    const next: Record<string, string> = { ...headers }

    if (slug) {
      next["x-shop"] = slug
      // Tells the back-end this sign-in belongs to a storefront, so the session
      // it mints is bound to `x-shop`. Without it the back-end falls back to
      // binding customers only, and a vendor or admin shopping here would hold
      // a session that reaches every other shop.
      next[STOREFRONT_CLIENT_HEADER] = "1"
    }

    // An explicit override still wins — the sign-in mutations send
    // `authorization: ""` so a stale token cannot make the back-end reject
    // the very call that issues a new one. Note it suppresses only the bearer:
    // `x-shop` is still attached, which is what lets the back-end bind the new
    // session to this shop.
    if (!("authorization" in headers)) {
      const token = sessionAccessToken(slug)
      if (token) next.authorization = `Bearer ${token}`
    }

    // Stashed so the error link can act on the shop the operation was actually
    // sent for, rather than on whatever `window.location` says by the time it
    // fails.
    return { headers: next, shopSlug: slug }
  })
}

function makeLocaleLink() {
  return new SetContextLink((prevContext) => {
    const { headers = {} } = prevContext as HeaderContext
    return {
      headers: {
        ...headers,
        "accept-language": getCookie(LOCALE_COOKIE_NAME) || DEFAULT_LOCALE,
      },
    }
  })
}

function makeErrorLink() {
  return new ErrorLink(({ error, operation, forward }) => {
    if (!CombinedGraphQLErrors.is(error)) {
      console.error(
        `[Network Error] ${error.message} | operation: ${operation.operationName}`,
      )
      return
    }

    const first = error.errors[0]
    const extensions = (first?.extensions ?? {}) as {
      error_code?: string
      code?: string
      validation_errors?: Array<{
        field: string
        code: string
        messages: string[]
      }>
    }
    const code = extensions.error_code ?? extensions.code

    // The shop this operation was sent for, stashed by the session link. Read
    // it back rather than asking the URL again: by the time a request fails the
    // visitor may already be on another shop, and acting on that one would sign
    // them out of a storefront that never had a problem.
    const opSlug =
      (operation.getContext() as { shopSlug?: string | null }).shopSlug ?? null

    // Expired access token: rotate once, then replay the operation.
    if (code === "TOKEN_EXPIRED" && opSlug && typeof window !== "undefined") {
      return from(
        import("@/shared/auth/refresh").then(({ refreshAccessToken }) =>
          refreshAccessToken(opSlug),
        ),
      ).pipe(
        mergeMap((newToken) => {
          if (!newToken) {
            void import("@/shared/auth/session").then(({ forceLogout }) =>
              forceLogout(opSlug, signInUrl(opSlug)),
            )
            return of()
          }
          operation.setContext(({ headers = {} }) => ({
            headers: { ...headers, authorization: `Bearer ${newToken}` },
          }))
          return forward(operation)
        }),
      )
    }

    // A genuine session, presented at the wrong shop. Deliberately handled
    // above — and deliberately kept out of AUTH_ERROR_CODES — because the
    // remedy is signing in to *this* shop, not a global sign-out: the
    // visitor's sessions at other storefronts are untouched and valid.
    if (code === "SHOP_SESSION_MISMATCH" && typeof window !== "undefined") {
      void import("@/shared/auth/session").then(({ forceLogout }) =>
        forceLogout(opSlug, shopPathFor(opSlug, "/login?shop_session=1")),
      )
      return
    }

    if (code && AUTH_ERROR_CODES.has(code) && typeof window !== "undefined") {
      void import("@/shared/auth/session").then(({ forceLogout }) =>
        forceLogout(opSlug, signInUrl(opSlug)),
      )
      return
    }

    // `validation_errors` is where the answer actually lives. Every failure the
    // back-end raises through `AppException.validation` — a DTO rule and a
    // business rule alike — arrives as the same bare "Validation failed", so a
    // log without this line names the operation and nothing else: an order
    // refused because no location can ship one of its lines reads exactly like
    // a malformed input. The list is short and already client-visible.
    const details = extensions.validation_errors
      ?.map((e) => `${e.field}: ${e.code} — ${e.messages.join("; ")}`)
      .join(" | ")
    console.error(
      `[GraphQL Error] ${first?.message} | operation: ${operation.operationName} | code: ${code}${details ? ` | ${details}` : ""}`,
    )
  })
}

/**
 * Where a rejected session lands.
 *
 * The consoles have one `/login`; here every shop has its own, so the redirect
 * has to be rebuilt from the shop the failing operation belonged to. Falling
 * back to `/` (the shop picker) rather than a bare `/login` matters — `/login`
 * is a shop slug as far as the router is concerned, and would 404 looking for a
 * shop by that name.
 *
 * Built through `shopPathFor` because the shop is now reachable at two
 * addresses: on `acme.zaydak.com` the sign-in screen is `/login`, and the
 * `/acme/login` this used to emit would 404 there — turning an expired session
 * into a dead end instead of a sign-in form.
 */
function signInUrl(slug: string | null): string {
  return slug ? shopPathFor(slug, "/login?expired=1") : "/"
}

export function composeLinks(): ApolloLink {
  return makeErrorLink()
    .concat(makeSessionLink())
    .concat(makeLocaleLink())
    .concat(new HttpLink({ uri: GRAPHQL_URL, headers: tunnelHeaders(GRAPHQL_URL) }))
}
