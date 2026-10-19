import { HttpLink, type ApolloLink } from "@apollo/client"
import { SetContextLink } from "@apollo/client/link/context"
import { ErrorLink } from "@apollo/client/link/error"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import { from, mergeMap, of } from "rxjs"
import { tunnelHeaders } from "./tunnel-headers"

export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/graphql"

/**
 * Apollo links for the admin console.
 *
 * Deliberately thinner than the vendor dashboard's: there is no `X-SHOP` link
 * (the console is platform-scoped, not shop-scoped) and no locale link yet.
 */

type HeaderContext = { headers?: Record<string, string> }

const AUTH_ERROR_CODES = new Set([
  "TOKEN_INVALID",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "AUTHENTICATION_REQUIRED",
])

function makeAuthLink(getToken: () => string | null | undefined) {
  return new SetContextLink((prevContext) => {
    const { headers = {} } = prevContext as HeaderContext
    // An explicit override wins — the login mutation sends no Authorization.
    if ("authorization" in headers) return { headers }
    const token = getToken()
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
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

    // Expired access token: rotate once, then replay the operation.
    if (code === "TOKEN_EXPIRED" && typeof window !== "undefined") {
      return from(
        import("@/shared/auth/refresh").then(({ refreshAccessToken }) =>
          refreshAccessToken(),
        ),
      ).pipe(
        mergeMap((newToken) => {
          if (!newToken) {
            void import("@/shared/auth/session").then(({ forceLogout }) =>
              forceLogout("/login?expired=1"),
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

    if (code && AUTH_ERROR_CODES.has(code) && typeof window !== "undefined") {
      void import("@/shared/auth/session").then(({ forceLogout }) =>
        forceLogout("/login?expired=1"),
      )
      return
    }

    const details = extensions.validation_errors
      ?.map((e) => `${e.field}: ${e.code} — ${e.messages.join("; ")}`)
      .join(" | ")
    console.error(
      `[GraphQL Error] ${first?.message} | operation: ${operation.operationName} | code: ${code}${details ? ` | ${details}` : ""}`,
    )
  })
}

export function composeLinks(getToken: () => string | null | undefined): ApolloLink {
  return makeErrorLink()
    .concat(makeAuthLink(getToken))
    .concat(new HttpLink({ uri: GRAPHQL_URL, headers: tunnelHeaders(GRAPHQL_URL) }))
}
