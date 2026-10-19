import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

// `i18n/request.ts` provides the locale + messages per request. We
// resolve from a cookie (not URL), so no routing config / middleware is
// wired here — just the request-config path.
const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

// Only emits the treemap when `ANALYZE=true npm run build`; otherwise it is a
// passthrough, so normal builds are unaffected.
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const graphqlProxy = process.env.GRAPHQL_PROXY_TARGET

const nextConfig: NextConfig = {
  // Local-only: when GRAPHQL_PROXY_TARGET is set, the browser talks to
  // same-origin `/graphql` and Next forwards to the live API. Production CORS
  // does not allow http://localhost:3001, and we are not changing the back-end.
  async rewrites() {
    if (!graphqlProxy) return []
    return [{ source: "/graphql", destination: graphqlProxy }]
  },
  // Google Identity Services on http://localhost needs a looser referrer.
  async headers() {
    if (process.env.NODE_ENV === "production") return []
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer-when-downgrade",
          },
        ],
      },
    ]
  },
  // `@repo/ui` and `@repo/storefront-templates` export raw .tsx, so Next
  // compiles them instead of treating them as prebuilt node_modules.
  transpilePackages: ["@repo/ui", "@repo/storefront-templates"],
  // Jurat imports its oud recordings as modules. Neither bundler has a
  // built-in type for .mp3, so the build stops on the first file. Both rules
  // emit the file and the import evaluates to its URL.
  turbopack: {
    rules: {
      "*.mp3": {
        type: "asset",
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mp3$/,
      type: "asset/resource",
    })
    return config
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      // The BunnyCDN pull zone every real upload is served from. Without it
      // `next/image` refuses to optimize an actual product photo — the whole
      // catalogue rendered through the raw URL or not at all. Wildcarded because
      // the zone name differs per environment (artam-staging today).
      { protocol: "https", hostname: "*.b-cdn.net" },
      // Custom hostname on the same pull zone (production: cdn.zaydak.com).
      { protocol: "https", hostname: "cdn.zaydak.com" },
    ],
    // placehold.co returns SVG by default; needed for seeded dev imagery.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Rewrite barrel imports to direct deep imports so unused exports are dropped
  // from each route's chunk. (Next 16 already does this for lucide-react.)
  experimental: {
    optimizePackageImports: [
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extensions",
      "date-fns",
    ],
  },
};

export default withSentryConfig(withAnalyzer(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source-map upload runs on `next build` when SENTRY_AUTH_TOKEN is set
  // (CI / Vercel); without it, the build still succeeds (no upload).
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client bundles so minified stack traces resolve.
  widenClientFileUpload: true,

  // Proxy Sentry ingestion through the app's own domain to dodge ad-blockers.
  tunnelRoute: "/monitoring",

  // Only log SDK build output in CI.
  silent: !process.env.CI,
});
