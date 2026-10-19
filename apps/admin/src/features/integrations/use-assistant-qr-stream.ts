"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { GRAPHQL_URL } from "@/shared/apollo/links"
import { PLATFORM_WHATSAPP_QR_TICKET } from "./api-assistant"

/** REST base derived from the GraphQL URL (`…/graphql` → `…`). */
function restBase(): string {
  return GRAPHQL_URL.replace(/\/graphql\/?$/, "")
}

/**
 * Exponential backoff with a ceiling, jittered.
 *
 * Local rather than shared because this app has no other stream to share it
 * with. The jitter matters even for one screen: without it, several admins on a
 * console that came back after an outage would reconnect on the same tick.
 */
function reconnectDelayMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 30_000)
  return base + Math.random() * 500
}

/** What the server pushes down the pairing stream. */
export type AssistantStreamEvent =
  | { type: "qr"; qr: string }
  | { type: "connected" }
  | { type: "state"; state: string }
  | { type: "ping" }
  | { type: "expired" }
  | { type: "error"; message: string }

/**
 * The live pairing code for the assistant number.
 *
 * **A WhatsApp QR is not fetched once and displayed.** Baileys rotates it every
 * twenty to sixty seconds, so a screen that renders the first one and waits is
 * showing a dead code for most of every minute — and the admin blames their
 * camera. The stream is what keeps something scannable on screen.
 *
 * The handshake is the ticket dance the vendor dashboard already uses, for the
 * same reason: `EventSource` cannot set an Authorization header, so the
 * alternative is an access token in a query string, where it reaches proxy logs
 * and browser history and stays valid for an hour. The ticket is single-use and
 * lives thirty seconds — which is also why the reconnect has to be ours rather
 * than `EventSource`'s native retry, since that would replay a spent ticket
 * forever.
 *
 * `enabled` gates all of it. The stream opens only while pairing is actually in
 * progress, so an idle Integrations tab holds no socket and drives no poll loop
 * against the shared Evolution server.
 */
export function useAssistantQrStream({
  enabled,
  onEvent,
}: {
  enabled: boolean
  onEvent: (event: AssistantStreamEvent) => void
}): void {
  const client = useApolloClient()
  // Keep the latest callback without resubscribing on every render. Assigned in
  // an effect, not during render — a render can be discarded, and mutating the
  // ref there would leak that discarded callback into the stream.
  const cb = useRef(onEvent)
  useEffect(() => {
    cb.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return

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
        const res = await client.mutate<{
          platformWhatsAppQrTicket: { data: { ticket: string } | null }
        }>({
          mutation: PLATFORM_WHATSAPP_QR_TICKET,
          fetchPolicy: "no-cache",
        })
        ticket = res.data?.platformWhatsAppQrTicket.data?.ticket ?? ""
        if (!ticket) throw new Error("no ticket")
      } catch {
        // Reported in place on the screen rather than as a toast: a toast per
        // reconnect attempt would say the same thing every few seconds.
        cb.current({ type: "error", message: "stream" })
        scheduleReconnect()
        return
      }
      if (cancelled) return

      const url = `${restBase()}/whatsapp/qr/stream?ticket=${encodeURIComponent(ticket)}`
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
          cb.current(JSON.parse(event.data) as AssistantStreamEvent)
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
  }, [enabled, client])
}
