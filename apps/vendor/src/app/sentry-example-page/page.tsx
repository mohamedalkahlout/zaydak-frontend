"use client";

import * as Sentry from "@sentry/nextjs";

/**
 * TEMPORARY verification page — safe to DELETE once you've confirmed events
 * reach the configured Sentry project. Visit /sentry-example-page and click the
 * button; the error should show up in Sentry Issues within ~30s.
 */
class SentryExampleFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleFrontendError";
  }
}

export default function SentryExamplePage() {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Sentry test</h1>
      <p style={{ color: "#666", maxWidth: "30rem" }}>
        Throws a test error inside a Sentry span. Confirm it appears in the
        configured Sentry project, then delete this page.
      </p>
      <button
        type="button"
        onClick={async () => {
          await Sentry.startSpan(
            { name: "Example Frontend Span", op: "test" },
            async () => {
              throw new SentryExampleFrontendError(
                "Sentry example frontend error — this is expected.",
              );
            },
          );
        }}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Throw test error
      </button>
    </main>
  );
}
