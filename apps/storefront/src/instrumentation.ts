import * as Sentry from "@sentry/nextjs"

// Server-side registration hook. Next.js calls register() once per runtime;
// we load the matching Sentry init so server + edge errors are captured.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
