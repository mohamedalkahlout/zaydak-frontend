"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { GRAPHQL_URL } from "@/shared/lib/apollo/links"
import { useAuthStore } from "@/shared/stores/auth"
import { getCookie } from "@/shared/lib/cookies"
import { ACCESS_TOKEN_COOKIE } from "@/shared/lib/auth/cookie-names"
import { NOTIFICATION_STREAM_TICKET } from "./api"
import { reconnectDelayMs } from "./lib/backoff"
import type { StreamTicketResult } from "./types"

/** REST base derived from the GraphQL URL (`…/graphql` → `…`). */
function restBase(): string {
  return GRAPHQL_URL.replace(/\/graphql\/?$/, "")
}

function currentToken(): string | null {
  return useAuthStore.getState().accessToken ?? getCookie(ACCESS_TOKEN_COOKIE)
}

/**
 * Real-time notification delivery. Invokes `onNotification` when a notification
 * arrives, so the bell updates without waiting for the 60s poll.
 *
 * `EventSource` can't send an Authorization header. Rather than putting the
 * access token in the URL — where it would land in proxy access logs and
 * browser history — the hook first mints a one-shot, 30-second ticket over an
 * ordinary authenticated GraphQL mutation, then spends it on the stream URL.
 *
 * Because that ticket dies on first use, `EventSource`'s native retry is
 * useless here: it would replay a dead ticket forever. So on any error we close
 * the connection and re-handshake ourselves, backing off exponentially. The
 * server also ends each stream after a bounded lifetime (an `expired` frame),
 * which lands here as an error and triggers the same re-handshake — that is
 * what keeps a revoked or logged-out session from streaming indefinitely.
 *
 * All failures are silent: the polling query remains the correctness backstop.
 */
export function useNotificationsStream(onNotification: () => void): void {
  const token = useAuthStore((s) => s.accessToken)
  const client = useApolloClient()
  // Keep the latest callback without resubscribing the stream on every render.
  // Assigned in an effect, not during render — a render can be discarded, and
  // mutating the ref there would leak that discarded callback into the stream.
  const cb = useRef(onNotification)
  useEffect(() => {
    cb.current = onNotification
  }, [onNotification])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!(token ?? currentToken())) return

    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let cancelled = false

    function scheduleReconnect() {
      if (cancelled) return
      retryTimer = setTimeout(() => void connect(), reconnectDelayMs(attempt++))
    }

    async function connect() {
      if (cancelled) return

      let ticket: string
      try {
        const res = await client.mutate<StreamTicketResult>({
          mutation: NOTIFICATION_STREAM_TICKET,
          fetchPolicy: "no-cache",
          // This is a background handshake that retries on its own backoff and
          // is explicitly allowed to fail silently (see the file header). Tell
          // the Apollo error link to skip its toast + console.error so a
          // backend outage can't flood the console — that flood is what OOMs
          // the Turbopack dev server via per-trace source-map resolution.
          context: { silentErrors: true },
        })
        ticket = res.data?.notificationStreamTicket.ticket ?? ""
        if (!ticket) throw new Error("no ticket")
      } catch {
        scheduleReconnect()
        return
      }
      if (cancelled) return

      const url = `${restBase()}/notifications/stream?ticket=${encodeURIComponent(ticket)}`
      try {
        source = new EventSource(url)
      } catch {
        scheduleReconnect()
        return
      }

      // A stream that opened is a stream that worked — start the next backoff
      // from scratch rather than from however long the last outage ran.
      source.onopen = () => {
        attempt = 0
      }

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string }
          // Ignore connected/ping frames; refresh on real notifications.
          if (data.type === "notification") cb.current()
        } catch {
          // Non-JSON frame — ignore.
        }
      }

      source.onerror = () => {
        source?.close()
        source = null
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      source?.close()
    }
  }, [token, client])
}
