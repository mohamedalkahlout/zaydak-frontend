import "server-only"

import { cookies } from "next/headers"
import {
  registerApolloClient,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs"
import {
  ACCESS_TOKEN_COOKIE,
  ACTIVE_SHOP_KEY,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
} from "@/shared/lib/auth/cookie-names"
import { composeLinks } from "./links"

export const { getClient, query, PreloadQuery } = registerApolloClient(
  async () => {
    const cookieStore = await cookies()
    const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
    // Middleware writes this cookie from `/store/{shopSlug}/...` so server
    // queries can scope to the right shop via the X-SHOP header.
    const shopSlug = cookieStore.get(ACTIVE_SHOP_KEY)?.value
    const locale = cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE

    return new ApolloClient({
      cache: new InMemoryCache(),
      link: composeLinks(
        () => token,
        () => shopSlug,
        () => locale,
      ),
      defaultOptions: {
        watchQuery: { fetchPolicy: "cache-first" },
        query: { fetchPolicy: "cache-first" },
      },
    })
  },
)
