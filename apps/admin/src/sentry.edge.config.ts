import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/shared/sentry/scrub";

// Edge-runtime Sentry (middleware, edge routes). Loaded by `instrumentation.ts`.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: false,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  beforeSend(event) {
    scrubSentryEvent(
      event as unknown as Parameters<typeof scrubSentryEvent>[0],
    );
    return event;
  },
});
