import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent } from "@/shared/sentry/scrub"

// Edge-runtime Sentry (proxy, edge routes). Loaded by `instrumentation.ts`.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: false,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  beforeSend(event) {
    // Scrub mutates in place; double-cast keeps Sentry ErrorEvent assignable
    // across SDK bumps (required `type`, query_string union drift).
    scrubSentryEvent(
      event as unknown as Parameters<typeof scrubSentryEvent>[0],
    )
    return event
  },
})
