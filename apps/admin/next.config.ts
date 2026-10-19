import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

// `i18n/request.ts` provides the locale + messages per request. The locale comes
// from a cookie (not the URL), so there is no routing config or middleware here.
const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

const nextConfig: NextConfig = {
  // `@repo/ui` is a just-in-time workspace package: it exports raw .tsx, so Next
  // must compile it instead of treating it as a prebuilt node_module.
  transpilePackages: ["@repo/ui"],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source-map upload runs on `next build` when SENTRY_AUTH_TOKEN is set
  // (CI / Vercel); without it, the build still succeeds (no upload).
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Proxy Sentry ingestion through the app's own domain to dodge ad-blockers.
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
});
