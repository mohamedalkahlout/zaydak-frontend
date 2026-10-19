import "server-only"

import { HttpLink } from "@apollo/client"
import {
  CombinedGraphQLErrors,
  ServerError,
  ServerParseError,
} from "@apollo/client/errors"
import { ErrorLink } from "@apollo/client/link/error"
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs"
import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, resolveLocale } from "@/shared/i18n/config"
import { GRAPHQL_URL } from "./endpoint"
import { storefrontProductsFieldPolicy } from "./storefront-products-policy"
import { tunnelHeaders } from "./tunnel-headers"

/**
 * The storefront's **server-side** Apollo client.
 *
 * This is the half of the app that puts product copy into the HTML instead of
 * into a loading state. `PreloadQuery` runs a query during the RSC pass and
 * streams the result into the browser cache, where a client component reading
 * it with `useSuspenseQuery` resolves against the stream rather than the
 * network — so the markup React streams already contains the products, and the
 * browser makes no second round trip for data the server just fetched.
 *
 * Three things about it are deliberate.
 *
 * **It carries no credentials.** Every operation preloaded through it is a
 * public read (`shop`, `shops`, `storefrontProduct(s)`, `tags`, `collections`),
 * all of which run behind `OptionalJwtGuard`. Anything user-shaped — the cart,
 * the wishlist, `me`, orders — stays on the browser client, where the token
 * lives. A server client that could authenticate is a server client that can
 * serve one visitor's data to another out of a shared cache, and the cheapest
 * way to never do that is to have no token to send.
 *
 * **The shop scope is an argument, never ambient.** Nearly every storefront
 * operation is behind `RequireShopGuard`, so `X-SHOP` is not optional — but the
 * browser's trick of deriving it from `location.pathname` has no server
 * equivalent, and a module-level "current shop" would be shared by every
 * request in flight in the process, which is how one shop's page ends up
 * scoped to another's. So the slug is passed per call through
 * `storefrontContext(slug)` and `HttpLink` puts it on that request only.
 *
 * **`makeClient` is called per request**, not once per process:
 * `registerApolloClient` wraps it in React's `cache()`, which is
 * request-scoped. Returning a module singleton here would share one normalized
 * cache across every visitor.
 */

/**
 * Logs what a server-side operation actually failed on, before the transport
 * erases it.
 *
 * This exists because of one specific, otherwise undebuggable symptom. When a
 * `PreloadQuery` errors during the RSC pass, `@apollo/client-react-streaming`
 * puts a **contentless** `{ type: "error" }` marker into the stream it is
 * teeing to the browser — no message, no status, no operation name — and the
 * SSR half rethrows it as the fixed string *"Error from event stream. Redacted
 * for security concerns."* React then reports a recoverable error and switches
 * the whole subtree to client rendering. The redaction is deliberate on
 * Apollo's part (a server error must not be handed to a browser verbatim), but
 * it means the only report of the failure names neither the operation nor the
 * cause, and the server — which *does* know both — said nothing at all, because
 * this client had no error link on it.
 *
 * So the browser keeps the redacted string and the terminal gets the truth.
 * The callback only logs: returning nothing lets the error propagate exactly as
 * before, so nothing about the streaming behaviour changes.
 *
 * The two cases are worth separating because they mean opposite things. A
 * `CombinedGraphQLErrors` is the API answering — a shop that is closed, a slug
 * that resolves to nothing — and the `error_code` is the whole diagnosis. A
 * `ServerError` is the API *not* answering the way a GraphQL client expects:
 * this back-end returns real HTTP statuses for failures (404 for
 * `RESOURCE_NOT_FOUND`, 422 for `VALIDATION_ERROR`), so a status is worth
 * printing, and a bare network error — the API down, restarting, or mid-boot —
 * arrives here as neither and is the single most common reason a storefront
 * page degrades to client rendering in development.
 */
function serverErrorLink() {
  return new ErrorLink(({ error, operation }) => {
    const name = operation.operationName || "(anonymous)"

    if (CombinedGraphQLErrors.is(error)) {
      const first = error.errors[0]
      const extensions = (first?.extensions ?? {}) as {
        error_code?: string
        code?: string
      }
      const code = extensions.error_code ?? extensions.code
      console.error(
        `[storefront RSC] ${name} failed: ${first?.message}${code ? ` [${code}]` : ""}`,
      )
      return
    }

    const status =
      ServerError.is(error) || ServerParseError.is(error)
        ? ` (HTTP ${error.statusCode})`
        : ""
    console.error(
      `[storefront RSC] ${name} failed: ${error.message}${status} — ${GRAPHQL_URL}`,
    )
  })
}

export const { getClient, query, PreloadQuery } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          // Kept in step with the browser client (`apollo/client.tsx`) so a
          // preloaded row and the same row read later on the client normalize
          // to one cache entry rather than two.
          Query: {
            fields: {
              storefrontProducts: storefrontProductsFieldPolicy,
            },
          },
          PublicProduct: { keyFields: ["id"] },
          CartEnvelope: { keyFields: ["id"] },
        },
      }),
      link: serverErrorLink().concat(
        new HttpLink({ uri: GRAPHQL_URL, headers: tunnelHeaders(GRAPHQL_URL) }),
      ),
    }),
)

/**
 * Request headers for one server-side storefront query.
 *
 * `accept-language` mirrors the browser link so a back-end error message comes
 * back in the language being read; the locale is already resolved per request
 * by `i18n/request.ts`, so this adds no work and no extra dynamism.
 *
 * Pass no slug for the one route that has no shop — the `/` directory, where
 * `shops` is the only list query in the app not behind `RequireShopGuard`.
 */
export async function storefrontContext(shopSlug?: string) {
  const locale = await getLocale().catch(() => DEFAULT_LOCALE)

  return {
    headers: {
      ...tunnelHeaders(GRAPHQL_URL),
      ...(shopSlug ? { "x-shop": shopSlug } : {}),
      "accept-language": resolveLocale(locale),
    },
  }
}
