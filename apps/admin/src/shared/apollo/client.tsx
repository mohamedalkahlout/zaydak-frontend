"use client"

import { useEffect } from "react"
// The cache must come from the integration package too — it wraps InMemoryCache
// with the streaming/SSR transport, and the plain one is not assignable.
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs"

import { useAuthStore } from "@/shared/stores/auth"
import { getCookie } from "@/shared/lib/cookies"
import { ACCESS_TOKEN_COOKIE } from "@/shared/auth/cookie-names"
import { composeLinks } from "./links"

/**
 * `hydrate()` only runs in an effect, i.e. after the first render — so the
 * token getter falls back to the readable access cookie. Without that fallback
 * the first query of a freshly-loaded page would go out unauthenticated.
 */
function currentAccessToken(): string | null {
  return useAuthStore.getState().accessToken ?? getCookie(ACCESS_TOKEN_COOKIE)
}

function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    // Read the token per request, not at construction time, so a rotated token
    // is picked up without rebuilding the client.
    link: composeLinks(currentAccessToken),
  })
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  )
}
