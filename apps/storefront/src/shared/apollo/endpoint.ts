/**
 * The one place the GraphQL endpoint is spelled out.
 *
 * Three modules need it and they cannot share a file: `links.ts` is the browser
 * client and reaches for `window`, `rsc.ts` is `react-server`-only, and
 * `shop-server.ts` is a plain `fetch`. Importing any of those from another
 * would drag the wrong half of the app into the wrong bundle, so the constant
 * lives on its own with no imports of its own.
 */
export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/graphql"
