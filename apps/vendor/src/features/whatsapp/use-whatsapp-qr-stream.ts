"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { GRAPHQL_URL } from "@/shared/lib/apollo/links"
import { reconnectDelayMs } from "@/features/notifications/lib/backoff"
import { WHATSAPP_QR_TICKET } from "./api"
import type { WhatsAppQrTicketResult, WhatsAppStreamEvent } from "./types"

/** REST base derived from the GraphQL URL (`…/graphql` → `…`). */
function restBase(): string {
  return GRAPHQL_URL.replace(/\/graphql\/?$/, "")
}

/**
 * The live pairing code.
 *
 * A WhatsApp QR is not fetched once and shown — Baileys rotates it every twenty
 * to sixty seconds, so a screen that renders the first one and waits is showing
 * an expired code for most of every minute. The stream is what keeps the thing
 * on screen scannable.
 *
 * Same handshake as the notification bell (`useNotificationsStream`), and it
 * reuses that feature's backoff on purpose rather than growing a second one:
 * the ticket is single-use, so `EventSource`'s native retry would replay a dead
 * ticket forever, which makes the reconnect ours to get right in exactly the
 * same way. The one difference is what failure means. The bell is allowed to
 * fail silently because its polling query is the backstop; here there is no
 * backstop — a stream that never opens is a vendor watching a code that will
 * not refresh — so an error reaches the caller and the screen says so.
 *
 * `enabled` gates the whole thing: the stream opens only while a pairing is
 * actually in progress, so an idle Settings tab holds no socket and drives no
 * poll loop against the shared Evolution server.
 */
export function useWhatsAppQrStream({
  enabled,
  onEvent,
}: {
  enabled: boolean
  onEvent: (event: WhatsAppStreamEvent) => void
}): void {
  const client = useApolloClient()
  // Keep the latest callback without resubscribing on every render. Assigned
  // in an effect, not during render — a render can be discarded, and mutating
  // the ref there would leak that discarded callback into the stream.
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
        const res = await client.mutate<WhatsAppQrTicketResult>({
          mutation: WHATSAPP_QR_TICKET,
          fetchPolicy: "no-cache",
          // The hook reports failures through `onEvent` and the screen renders
          // them in place; a toast on top of that would say the same thing
          // twice, and every reconnect attempt would say it again.
          context: { silentErrors: true },
        })
        ticket = res.data?.whatsAppQrTicket.data.ticket ?? ""
        if (!ticket) throw new Error("no ticket")
      } catch {
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
          cb.current(JSON.parse(event.data) as WhatsAppStreamEvent)
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
