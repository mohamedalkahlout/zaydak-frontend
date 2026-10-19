"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "global-error" } })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            textAlign: "center",
            padding: "2rem",
            borderRadius: "1rem",
            background: "#18181b",
            border: "1px solid #27272a",
          }}
        >
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              margin: "0 0 0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              margin: "0 0 1.5rem",
            }}
          >
            An unexpected error occurred while rendering the page.
          </p>
          {error.digest ? (
            <p
              style={{
                color: "#71717a",
                fontSize: "0.75rem",
                margin: "-0.5rem 0 1.5rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "9999px",
              background: "#fafafa",
              color: "#09090b",
              border: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
