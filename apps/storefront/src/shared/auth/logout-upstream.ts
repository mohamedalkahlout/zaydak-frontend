import "server-only"

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

const LOGOUT_MUTATION = /* GraphQL */ `
  mutation StorefrontEndCustomerSession($token: String!) {
    endCustomerSession(token: $token) {
      success
    }
  }
`

/**
 * Revoke one refresh token upstream — the shop's customer's session, which
 * is the only kind this app holds.
 *
 * Signing out used to clear this app's cookies and stop there, which left the
 * refresh token live on the server for its full seven days. That mattered less
 * when a session was one thing; with a session per shop it directly undercuts
 * what "sign out of this shop" means — the row the visitor believes they closed
 * is still redeemable, and the LRU index and the server's view of live sessions
 * drift apart.
 *
 * Runs server-side because the refresh token is httpOnly and client JS must
 * never see it.
 *
 * **Never throws and never blocks the sign-out.** A visitor who asked to be
 * signed out gets their cookies cleared whether or not the API is reachable;
 * the token expires on its own. The caller awaits it only so the request is not
 * torn down mid-flight when the route handler returns.
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({
        query: LOGOUT_MUTATION,
        variables: { token },
      }),
      cache: "no-store",
    })
  } catch {
    // Deliberately silent — see above.
  }
}
