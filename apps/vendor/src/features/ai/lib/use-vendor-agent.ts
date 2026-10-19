"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { conversationKey } from "@/features/ai/lib/conversation-key"
import { useLazyQuery } from "@apollo/client/react"
import { VENDOR_AGENT_CONVERSATION } from "@/features/ai/api/queries"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"
import { readSseStream } from "./sse-parser"
import { applyFormPatchFromResult, currentLiveForm } from "./live-form"
import type {
  AgentApprovalDecision,
  AgentApprovalRequest,
  AssistantPart,
  VendorAgentConversationResponse,
  VendorAgentMessage,
  VendorAgentToolEvent,
} from "./types"

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Find the action row a `tool_progress` or `tool_result` frame belongs to.
 *
 * `call_id` is the answer whenever the server sent one. A single model turn
 * can issue two calls to the SAME tool — the backend's approval policy says
 * so in as many words, since it matches decisions on the id rather than the
 * name — and at that point "the pending row called `search_products`" names
 * two rows. Progress for the second would land on the first, and the first
 * result would close the wrong one.
 *
 * The name-based fallback is for a turn streamed by a back-end that predates
 * the id. It takes the OLDEST unresolved call of that name, because tool
 * calls are dispatched serially and therefore finish in the order they
 * started — the previous implementation took the newest, which is the wrong
 * end of the queue the moment there is more than one.
 */
export function findPendingTool(
  events: VendorAgentToolEvent[],
  name: string,
  callId?: string,
): VendorAgentToolEvent | undefined {
  if (callId) {
    const exact = events.find((e) => e.call_id === callId)
    if (exact) return exact
  }
  return events.find((e) => e.name === name && e.result === null)
}

function backendBase(): string {
  return process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
    : "http://localhost:3000"
}
function streamEndpoint(): string {
  return `${backendBase()}/vendor-agent/chat/stream`
}
function regenerateEndpoint(): string {
  return `${backendBase()}/vendor-agent/chat/regenerate/stream`
}
function resumeEndpoint(): string {
  return `${backendBase()}/vendor-agent/chat/resume/stream`
}

/** Structured image attachment sent alongside the message. The backend feeds
 * these to create_product / update_product so attached photos land on the
 * product deterministically — no reliance on the LLM copying URLs. */
export interface OutgoingAttachment {
  url: string
  thumbnail?: string
}

export interface StreamingAssistantState {
  text: string
  tool_events: VendorAgentToolEvent[]
  /** Ordered narration ⇄ action log built live from the SSE stream, so the
   * in-progress turn renders as an interleaved work log exactly like a
   * committed one. */
  parts: AssistantPart[]
}

export interface UseVendorAgentResult {
  messages: VendorAgentMessage[]
  streaming: StreamingAssistantState | null
  sending: boolean
  loadingHistory: boolean
  error: string | null
  conversationId: string | null
  /** Append a turn this hook did not stream — see the implementation. */
  appendMessage: (message: VendorAgentMessage) => void
  /** Non-null while a run is paused waiting on the vendor to approve or
   * reject a batch of gated writes. The last assistant message carries the
   * matching `approval` part; this flag is what tells the UI that card is
   * live rather than historical. */
  pendingApproval: AgentApprovalRequest[] | null
  send: (text: string, attachments?: OutgoingAttachment[]) => Promise<void>
  regenerate: () => Promise<void>
  /** Deliver the vendor's answer and stream the rest of the paused run. */
  resolveApproval: (decisions: AgentApprovalDecision[]) => Promise<void>
  stop: () => void
  reset: () => void
  switchConversation: (id: string) => Promise<void>
}

/**
 * Detect a thread reloaded mid-approval.
 *
 * A persisted `approval` part with no decisions means the run is still parked
 * on the server's checkpoint — so the card must come back live, with working
 * buttons, rather than as a record of something already settled.
 */
function pendingApprovalIn(
  messages: VendorAgentMessage[],
): AgentApprovalRequest[] | null {
  const last = messages.at(-1)
  if (!last || last.role !== "assistant") return null
  for (const part of last.parts ?? []) {
    if (part.kind === "approval" && part.decisions.length === 0) {
      return part.requests
    }
  }
  return null
}

/**
 * Streaming-first chat hook.
 *
 * Consumes the SSE endpoint `POST /vendor-agent/chat/stream`. Instead of
 * waiting for the full response (the old mutation pattern), we update
 * `streaming.text` and `streaming.tool_events` as events arrive, so the
 * chat bubble types out in real time and tool cards paint the moment
 * each tool starts/finishes.
 *
 * On `done`, the streaming state is collapsed into a normal committed
 * message in `messages`, matching the same shape as DB-persisted
 * history. Auto-nav watchers in the UI can treat it like any other
 * newly arrived assistant turn.
 *
 * Stop support: `stop()` calls abort() on the active AbortController,
 * which causes fetch to reject. We still commit whatever text had
 * arrived so far so the transcript stays truthful.
 */
export function useVendorAgent(): UseVendorAgentResult {
  const t = useTranslations("aiChat.agent")
  const shopSlug = useActiveShopStore((s) => s.slug)
  const storageKey = conversationKey(shopSlug)

  const [messages, setMessages] = useState<VendorAgentMessage[]>([])
  const [streaming, setStreaming] =
    useState<StreamingAssistantState | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<
    AgentApprovalRequest[] | null
  >(null)

  const hydratedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const [fetchConversation] = useLazyQuery<VendorAgentConversationResponse>(
    VENDOR_AGENT_CONVERSATION,
    { fetchPolicy: "network-only" },
  )

  const loadConversation = useCallback(
    async (id: string) => {
      setLoadingHistory(true)
      setError(null)
      try {
        const { data } = await fetchConversation({ variables: { id } })
        const convo = data?.vendorAgentConversation
        if (!convo) {
          if (typeof window !== "undefined") {
            localStorage.removeItem(storageKey)
          }
          setConversationId(null)
          setMessages([])
          return
        }
        setConversationId(convo.id)
        const loaded = convo.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          tool_events: m.tool_events ?? undefined,
          parts: m.parts ?? undefined,
          created_at: m.created_at,
        }))
        setMessages(loaded)
        // A thread can be reopened while its run is still parked on the
        // server's checkpoint — restore the live approval card so the vendor
        // can finish what they walked away from.
        setPendingApproval(pendingApprovalIn(loaded))
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loadHistoryFailed"))
      } finally {
        setLoadingHistory(false)
      }
    },
    [fetchConversation, storageKey, t],
  )

  /* eslint-disable react-hooks/set-state-in-effect --
   * Restoring persisted state after hydration is the one case an effect is
   * still the answer for. A `useState` initializer cannot do it: this page is
   * server-rendered and localStorage does not exist there, so reading it in
   * the initializer produces markup the server could never have sent and React
   * throws out the whole tree on a hydration mismatch. Nor is it a
   * `useSyncExternalStore` — this hook OWNS the conversation and writes the key
   * back; storage is where it is parked between visits, not a store it
   * observes. `loadConversation` also fetches, which an initializer may not do.
   */
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(storageKey)
    if (stored) void loadConversation(stored)
  }, [storageKey, loadConversation])
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Core SSE consumer shared by `send` and `regenerate`. Callers set up
   * local state (optimistic user message, removal of stale assistant,
   * etc.) and hand us the endpoint + body to POST. We own: the abort
   * controller, streaming state updates, and committing the final
   * assistant message when the stream finishes.
   */
  const runStream = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      opts: { replaceLast?: boolean } = {},
    ) => {
      const token = useAuthStore.getState().accessToken
      const slug = useActiveShopStore.getState().slug
      if (!token || !slug) {
        setError(t("notSignedIn"))
        setSending(false)
        return
      }

      setError(null)
      setSending(true)
      setPendingApproval(null)
      setStreaming({ text: "", tool_events: [], parts: [] })

      const controller = new AbortController()
      abortRef.current = controller

      let accumulatedText = ""
      const toolEvents: VendorAgentToolEvent[] = []

      // Ordered narration ⇄ action log, built live from the stream the same
      // way the backend builds it — so the in-progress turn already reads as
      // an interleaved work log, and the committed message matches the shape
      // we'll later reload from the DB. `textBuffer` holds the current
      // narration run; it's flushed into a text part right before a tool
      // batch (and once at the end).
      const parts: AssistantPart[] = []
      let textBuffer = ""
      const flushText = () => {
        if (textBuffer.length > 0) {
          parts.push({ kind: "text", text: textBuffer })
          textBuffer = ""
        }
      }
      // Snapshot for React: committed parts plus the still-typing narration
      // as a trailing text part, so the caret'd text shows while streaming.
      const liveParts = (): AssistantPart[] =>
        textBuffer.length > 0
          ? [...parts, { kind: "text", text: textBuffer }]
          : [...parts]
      const pushStreaming = () =>
        setStreaming({
          text: accumulatedText,
          tool_events: [...toolEvents],
          parts: liveParts(),
        })

      const commit = (
        finalText: string,
        finalEvents: VendorAgentToolEvent[],
        finalParts: AssistantPart[],
      ) => {
        const assistantMsg: VendorAgentMessage = {
          id: newId(),
          role: "assistant",
          content: finalText,
          tool_events: finalEvents.length ? finalEvents : undefined,
          parts: finalParts.length ? finalParts : undefined,
          created_at: new Date().toISOString(),
        }
        // A resumed run returns the WHOLE turn — its `parts` span the pause,
        // so the paused bubble is replaced rather than followed by a second
        // one that repeats the narration and the approval card.
        setMessages((prev) =>
          opts.replaceLast && prev.at(-1)?.role === "assistant"
            ? [...prev.slice(0, -1), assistantMsg]
            : [...prev, assistantMsg],
        )
        setStreaming(null)
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-SHOP": slug,
            ...tunnelHeaders(),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          throw new Error(
            errText || t("requestFailed", { status: res.status }),
          )
        }
        if (!res.body) throw new Error(t("noBody"))

        const reader = res.body.getReader()
        for await (const event of readSseStream(reader)) {
          if (event.type === "conversation_ready") {
            const d = event.data as { conversation_id: string }
            setConversationId(d.conversation_id)
            if (typeof window !== "undefined") {
              localStorage.setItem(storageKey, d.conversation_id)
            }
          } else if (event.type === "text_delta") {
            const d = event.data as { delta: string }
            accumulatedText += d.delta
            textBuffer += d.delta
            pushStreaming()
          } else if (event.type === "tool_start") {
            const d = event.data as {
              name: string
              args: Record<string, unknown>
              call_id?: string
            }
            // Narration that preceded this tool becomes a text part above it.
            flushText()
            // One object reference lives in BOTH lists — `toolEvents` for the
            // flat contract, `parts` for ordering — so filling it in on
            // tool_result updates both without a rebuild.
            const event_: VendorAgentToolEvent = {
              name: d.name,
              args: d.args,
              ok: true,
              result: null,
              call_id: d.call_id,
            }
            toolEvents.push(event_)
            parts.push({ kind: "tool", event: event_ })
            pushStreaming()
          } else if (event.type === "tool_progress") {
            // Advisory only: it carries no result, so a frame for a call we
            // never saw start is dropped rather than inventing a row.
            const d = event.data as {
              name: string
              call_id: string
              phase?: string
              done?: number
              total?: number
              label?: string
            }
            const target = findPendingTool(toolEvents, d.name, d.call_id)
            if (target) {
              // Replaced, not merged: a frame is the whole current state of
              // the tool, and merging would leave a stale `done` under a new
              // phase that reports no counts.
              target.progress = {
                phase: d.phase,
                done: d.done,
                total: d.total,
                label: d.label,
              }
              pushStreaming()
            }
          } else if (event.type === "tool_result") {
            const d = event.data as {
              name: string
              ok: boolean
              result: unknown
              error?: string
              call_id?: string
            }
            // Mutate the pending event in place so the shared reference in
            // `parts` updates too.
            const target = findPendingTool(toolEvents, d.name, d.call_id)
            if (target) {
              target.ok = d.ok
              target.result = d.result
              target.error = d.error
              // The row is finished; a bar left under it reads as still
              // working.
              target.progress = null
            }
            // A `patch_form` result is staged into the product form on
            // screen — before the push, so its card renders knowing whether
            // it got there. Live frames only: a thread reloaded from history
            // never passes this way, so an old patch cannot be re-applied.
            if (d.ok) applyFormPatchFromResult(d.result)
            pushStreaming()
          } else if (event.type === "approval_required") {
            // Terminal for this request: the graph is parked on its
            // checkpoint and produces nothing more until `resolveApproval`
            // sends a decision. Commit what arrived so the paused turn — the
            // narration plus the approval card — is a normal message the
            // vendor can leave and come back to.
            const d = event.data as {
              requests: AgentApprovalRequest[]
              reply: string
              tool_events: VendorAgentToolEvent[]
              parts: AssistantPart[]
            }
            flushText()
            commit(d.reply, d.tool_events, d.parts ?? parts)
            setPendingApproval(d.requests)
            return
          } else if (event.type === "done") {
            const d = event.data as {
              reply: string
              tool_events: VendorAgentToolEvent[]
              parts?: AssistantPart[]
            }
            // Prefer the server's authoritative ordered parts; fall back to
            // the locally-built log if an older backend omits them.
            flushText()
            commit(d.reply, d.tool_events, d.parts ?? parts)
            return
          } else if (event.type === "error") {
            // The failure belongs to the turn that died, not to a banner
            // beside it: keep whatever narration and tool rows it produced
            // and put the error under them, so a reload shows the same
            // thing the live session did and the retry has something to
            // rewind to. `code`/`retryable` are what decide between a Retry
            // button and "the platform team has been notified"; an older
            // back-end sends neither, so both have conservative defaults.
            const d = event.data as {
              message: string
              code?: string
              retryable?: boolean
            }
            flushText()
            parts.push({
              kind: "error",
              code: d.code ?? "UNKNOWN",
              message: d.message,
              retryable: d.retryable ?? true,
            })
            commit(accumulatedText, toolEvents, parts)
            return
          }
        }

        // The socket closed with no `done` and no `error`. That is not a
        // finished reply — a proxy dropping an idle connection mid-turn looks
        // exactly like this — so say so rather than presenting a truncated
        // answer as complete.
        flushText()
        if (parts.length > 0 || accumulatedText) {
          parts.push({
            kind: "error",
            code: "STREAM_CLOSED",
            message: t("stoppedEarly"),
            retryable: true,
          })
        }
        commit(accumulatedText, toolEvents, parts)
      } catch (err) {
        if (controller.signal.aborted) {
          flushText()
          commit(accumulatedText, toolEvents, parts)
          return
        }
        // A transport failure used to throw away everything that had already
        // arrived and replace the half-read reply with the browser's own
        // "Failed to fetch" — in English, on an Arabic UI. Keep the partial
        // turn and close it with a retryable error row instead. That
        // "Failed to fetch" is a TypeError, so it gets our own sentence; the
        // errors thrown above already carry one.
        flushText()
        parts.push({
          kind: "error",
          code: "STREAM_CLOSED",
          message:
            err instanceof Error && err.message && !(err instanceof TypeError)
              ? err.message
              : t("connectionDropped"),
          retryable: true,
        })
        commit(accumulatedText, toolEvents, parts)
      } finally {
        setSending(false)
        abortRef.current = null
      }
    },
    [storageKey, t],
  )

  const send = useCallback(
    async (text: string, attachments?: OutgoingAttachment[]) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      const userMsg: VendorAgentMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])

      // The product form the assistant prepared, if it is on screen and
      // unsaved — read now, at send time, so the turn sees what the vendor
      // sees. An API without the live form channel ignores the field.
      const form = currentLiveForm()
      await runStream(streamEndpoint(), {
        message: trimmed,
        conversation_id: conversationId ?? undefined,
        // Structured channel for attached images — the text `message` still
        // carries the [Attached images: …] marker for context + reload display.
        ...(attachments?.length ? { attachments } : {}),
        ...(form ? { form } : {}),
      })
    },
    [conversationId, sending, runStream],
  )

  const regenerate = useCallback(async () => {
    if (sending || !conversationId) return

    // The turn being replaced, decided from the transcript the vendor is
    // looking at — this render's `messages`, like `sending` above. It used to
    // be a flag set inside the `setMessages` updater and read straight after
    // the call, which only holds when React runs the updater eagerly; with
    // another update to this hook already queued in the same tick the updater
    // is deferred to the next render, the flag still read false, and Retry
    // silently did nothing.
    const last = messages.at(-1)
    if (!last || last.role !== "assistant") return

    // Optimistically drop the old assistant turn so the vendor sees an
    // empty slot filling up as the new stream lands — no flicker. By id, so
    // a turn appended in the meantime is not the one that goes.
    setMessages((prev) => prev.filter((m) => m.id !== last.id))

    // The form as it is now: the new answer is to the vendor's screen, not
    // to the one the replayed message was first sent from.
    const form = currentLiveForm()
    await runStream(regenerateEndpoint(), {
      conversation_id: conversationId,
      ...(form ? { form } : {}),
    })
  }, [conversationId, messages, sending, runStream])

  const resolveApproval = useCallback(
    async (decisions: AgentApprovalDecision[]) => {
      if (sending || !conversationId || !pendingApproval) return

      // The paused bubble already holds the approval card; the resumed run
      // returns the completed turn in full, so it replaces that bubble.
      await runStream(
        resumeEndpoint(),
        { conversation_id: conversationId, decisions },
        { replaceLast: true },
      )
    },
    [conversationId, pendingApproval, sending, runStream],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(null)
    setConversationId(null)
    setError(null)
    setPendingApproval(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  /**
   * Append a turn this hook did not produce.
   *
   * The one caller is the save receipt: the server writes an assistant row
   * when the vendor saves something the agent prepared, and the transcript
   * has to show it without a stream to carry it in. Guarded on the id so the
   * same row cannot land twice — the mutation is idempotent server-side, so a
   * retried save returns the row already written rather than a new one, and
   * appending that blindly would show the vendor two receipts for one save.
   */
  const appendMessage = useCallback((message: VendorAgentMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message],
    )
  }, [])

  const switchConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort()
      setStreaming(null)
      // Cleared here rather than only in loadConversation, so a slow history
      // fetch can't leave the previous thread's approval card live over the
      // new one.
      setPendingApproval(null)
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, id)
      }
      await loadConversation(id)
    },
    [loadConversation, storageKey],
  )

  return {
    messages,
    appendMessage,
    streaming,
    sending,
    loadingHistory,
    error,
    conversationId,
    pendingApproval,
    send,
    regenerate,
    resolveApproval,
    stop,
    reset,
    switchConversation,
  }
}
