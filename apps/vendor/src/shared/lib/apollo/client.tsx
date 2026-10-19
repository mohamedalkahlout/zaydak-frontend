"use client";

import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import {
  ACCESS_TOKEN_COOKIE,
  ACTIVE_SHOP_KEY,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
} from "@/shared/lib/auth/cookie-names";
import { composeLinks } from "./links";
import { createInflightTracker, registerInflightTracker } from "./inflight";
import { useAuthStore } from "@/shared/stores/auth";
import { useActiveShopStore } from "@/shared/stores/active-shop";
import { getCookie } from "@/shared/lib/cookies";
import { TokenRefreshProvider } from "@/shared/lib/auth/token-refresh-provider";
import { ShopCacheBoundary } from "./shop-cache-boundary";

function getClientToken(): string | null {
  // Zustand store is the source of truth; fall back to cookie
  // before hydration completes.
  return useAuthStore.getState().accessToken ?? getCookie(ACCESS_TOKEN_COOKIE);
}

function getActiveShopSlug(): string | null {
  // Zustand store first; fall back to localStorage, then the middleware-
  // written cookie before hydration completes.
  const fromStore = useActiveShopStore.getState().slug;
  if (fromStore) return fromStore;
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SHOP_KEY) ?? getCookie(ACTIVE_SHOP_KEY);
}

function getLocale(): string {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return (
    getCookie(LOCALE_COOKIE) ??
    document.documentElement.lang ??
    DEFAULT_LOCALE
  );
}

function makeClient() {
  // Head of the chain, so it holds an operation for as long as *any* link is
  // still working on it. `useSwitchShop` reads it before writing the
  // active-shop store, because that write clears the cache and Apollo cancels
  // whatever is still in flight with an error no link can catch.
  const tracker = createInflightTracker();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: tracker.link.concat(
      composeLinks(getClientToken, getActiveShopSlug, getLocale),
    ),

    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-first" },
      query: { fetchPolicy: "cache-first" },
    },
  });

  registerInflightTracker(client, tracker);
  return client;
}

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      <ShopCacheBoundary>
        <TokenRefreshProvider>{children}</TokenRefreshProvider>
      </ShopCacheBoundary>
    </ApolloNextAppProvider>
  );
}
