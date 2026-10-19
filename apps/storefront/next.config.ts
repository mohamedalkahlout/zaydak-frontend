import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

// `i18n/request.ts` provides the locale + messages per request. The locale comes
// from a cookie (not the URL), so there is no routing config or middleware here
// — the one dynamic segment this app has is the shop slug, not a locale.
const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

// With no CDN configured the API stores uploads on its own disk and hands back
// `http://localhost:3000/uploads/...`. Serving those through `next/image` takes
// two settings, and both are development-only — see the comments below.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
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
  // Google Identity Services on http://localhost needs a looser referrer so
  // FedCM / GIS can identify the origin. Production keeps Next's default.
  async headers() {
    if (!isDev) return []
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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      // The BunnyCDN pull zone every real upload is served from — same list as
      // the vendor dashboard's, because it is the same catalogue imagery.
      { protocol: "https", hostname: "*.b-cdn.net" },
      // Custom hostname on the same pull zone (production: cdn.zaydak.com).
      { protocol: "https", hostname: "cdn.zaydak.com" },
      // The dev API's uploads. Scoped to the one path it serves them from, so
      // this can never widen into "anything on localhost:3000".
      ...(isDev
        ? ([
            {
              protocol: "http",
              hostname: "localhost",
              port: "3000",
              pathname: "/uploads/**",
            },
          ] as const)
        : []),
    ],
    // Next 16 resolves every remote image's host and refuses the request when it
    // lands on a private IP — an SSRF guard that fires *before* `remotePatterns`
    // is consulted and reports the same `"url" parameter is not allowed`, so a
    // matching pattern alone leaves the tile broken with no clue why. `localhost`
    // is 127.0.0.1, so the dev API's own uploads are exactly what it blocks.
    // Never enabled in production, where turning it off is the point of it.
    dangerouslyAllowLocalIP: isDev,
    // placehold.co returns SVG by default; needed for seeded dev imagery.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Same-origin ingest so ad-blockers cannot drop the report. The proxy
  // matcher excludes `/monitoring` so a shop host does not rewrite it to
  // `/[shopSlug]/monitoring`.
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
})
