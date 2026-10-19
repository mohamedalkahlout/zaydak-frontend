"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { GRAPHQL_URL } from "@/shared/lib/apollo/links"
import { useAuthStore } from "@/shared/stores/auth"
import { getCookie } from "@/shared/lib/cookies"
import { ACCESS_TOKEN_COOKIE } from "@/shared/lib/auth/cookie-names"
import { reconnectDelayMs } from "../notifications/lib/backoff"
import { WHATSAPP_INBOX_TICKET } from "./api"
import type { WhatsAppInboxTicketResult } from "./types"

/** REST base derived from the GraphQL URL (`…/graphql` → `…`). */
function restBase(): string {
  return GRAPHQL_URL.replace(/\/graphql\/?$/, "")
}

function currentToken(): string | null {
  return useAuthStore.getState().accessToken ?? getCookie(ACCESS_TOKEN_COOKIE)
}

export interface WhatsAppInboxEvent {
  type: string
  shop_id?: string
  conversation_id?: string
  event?: string
}

/**
 * Real-time WhatsApp inbox streaming via SSE.
 * Replaces 30s polling with instant server-sent push events.
 *
 * Uses ticket handshake to avoid sending authorization headers over EventSource.
 */
export function useWhatsAppInboxStream(
  onEvent: (event: WhatsAppInboxEvent) => void,
): void {
  const token = useAuthStore((s) => s.accessToken)
  const client = useApolloClient()
  const cb = useRef(onEvent)
  useEffect(() => {
    cb.current = onEvent
  }, [onEvent])

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
        const res = await client.mutate<WhatsAppInboxTicketResult>({
          mutation: WHATSAPP_INBOX_TICKET,
          fetchPolicy: "no-cache",
          context: { silentErrors: true },
        })
        ticket = res.data?.whatsAppInboxTicket.data?.ticket ?? ""
        if (!ticket) throw new Error("no ticket")
      } catch {
        scheduleReconnect()
        return
      }
      if (cancelled) return

      const url = `${restBase()}/whatsapp/inbox/stream?ticket=${encodeURIComponent(ticket)}`
      try {
        source = new EventSource(url)
      } catch {
        scheduleReconnect()
        return
      }

      source.onopen = () => {
        attempt = 0
      }

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WhatsAppInboxEvent
          if (data.type === "inbox_event") {
            cb.current(data)
          }
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
      if (retryTimer) clearTimeout(retryTimer)
      if (source) {
        source.close()
        source = null
      }
    }
  }, [client, token])
}
