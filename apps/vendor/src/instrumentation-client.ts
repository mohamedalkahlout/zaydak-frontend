import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/shared/sentry/scrub";

// Browser-runtime Sentry. Next.js loads this automatically on the client.
// No DSN in the bundle unless the deployment set one — capture is then a no-op.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // This is a financial dashboard, so do NOT attach IP/PII by default.
  sendDefaultPii: false,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: process.env.NEXT_PUBLIC_SENTRY_DSN
    ? [Sentry.replayIntegration()]
    : [],

  beforeSend(event) {
    // Scrub mutates in place; double-cast keeps Sentry ErrorEvent assignable
    // across SDK bumps (required `type`, query_string union drift).
    scrubSentryEvent(
      event as unknown as Parameters<typeof scrubSentryEvent>[0],
    );
    return event;
  },
});


export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
