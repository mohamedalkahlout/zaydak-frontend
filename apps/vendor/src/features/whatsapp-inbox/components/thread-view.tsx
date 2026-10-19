"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  BotOff,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  SendHorizontal,
  TriangleAlert,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Textarea } from "@repo/ui/components/textarea"
import {
  GET_WHATSAPP_THREAD,
  GET_WHATSAPP_THREADS,
  BLOCK_CUSTOMER_FROM_AI,
  MARK_WHATSAPP_THREAD_READ,
  UNBLOCK_CUSTOMER_FROM_AI,
  REPLY_TO_WHATSAPP_THREAD,
  RESUME_WHATSAPP_ASSISTANT,
} from "../api"
import type {
  BlockCustomerResult,
  MarkThreadReadResult,
  ReplyResult,
  ResumeResult,
  UnblockCustomerResult,
  WhatsAppThreadResult,
} from "../types"
import {
  EMAIL_REPLY_POLL_MS,
  EMAIL_REPLY_SENDING_WINDOW_MS,
  isEmailReply,
  newestPendingEmailReplyAt,
} from "../lib/delivery"
import { ContactReplyBox } from "./contact-reply-box"
import { MessageBubble } from "./message-bubble"
import { ThreadOrders } from "./thread-orders"

/**
 * One conversation, and the box that answers it.
 *
 * **Replying takes the conversation.** The server pauses the assistant on every
 * merchant reply, and that is deliberate rather than incidental: a human is now
 * in the thread, and a bot answering the next message underneath them would
 * contradict the person who just spoke. The screen says so above the box rather
 * than letting a merchant discover it.
 *
 * The send is a plain action, not a staged edit, so this screen is outside the
 * contextual save bar: there is no draft to reconcile against a server value —
 * a message is sent or it is not.
 */
export function ThreadView({ threadId }: { threadId: string }) {
  const t = useTranslations("whatsappInbox")
  const [body, setBody] = useState("")
  /** A reply is in flight; see the submit handler. */
  const replying = useRef(false)

  const { data, loading, startPolling, stopPolling } =
    useQuery<WhatsAppThreadResult>(GET_WHATSAPP_THREAD, {
      variables: { id: threadId },
      // The thread changes underneath this screen — a customer writes, the
      // assistant answers — so a cache read alone would show a conversation as
      // of whenever it was last opened.
      fetchPolicy: "cache-and-network",
    })

  const [reply, { loading: sending }] = useMutation<ReplyResult>(
    REPLY_TO_WHATSAPP_THREAD,
    {
      // Both: the thread gains the message, and the list's preview and
      // waiting-count both move.
      refetchQueries: [GET_WHATSAPP_THREAD, GET_WHATSAPP_THREADS],
      onCompleted: () => {
        setBody("")
        // "Queued", not "sent". The mutation returns once the job is on the
        // outbound queue and a worker delivers after — a toast claiming
        // delivery would make the word meaningless.
        sileo.success({ title: t("reply.queued") })
      },
      onError: (err) =>
        sileo.error({ title: t("reply.failed"), description: err.message }),
    },
  )

  const [resume, { loading: resuming }] = useMutation<ResumeResult>(
    RESUME_WHATSAPP_ASSISTANT,
    {
      refetchQueries: [GET_WHATSAPP_THREAD, GET_WHATSAPP_THREADS],
      onCompleted: () => sileo.success({ title: t("resume.done") }),
      onError: (err) =>
        sileo.error({ title: t("resume.failed"), description: err.message }),
    },
  )

  const [markRead] = useMutation<MarkThreadReadResult>(
    MARK_WHATSAPP_THREAD_READ,
    {
      refetchQueries: [GET_WHATSAPP_THREADS],
    },
  )

  const [block, { loading: blocking }] = useMutation<BlockCustomerResult>(
    BLOCK_CUSTOMER_FROM_AI,
    {
      // Both, so the open thread and the list chip agree — the same pair
      // `resumeWhatsAppAssistant` above refetches, for the same reason.
      refetchQueries: [GET_WHATSAPP_THREAD, GET_WHATSAPP_THREADS],
      onCompleted: () => sileo.success({ title: t("block.done") }),
      onError: (err) =>
        sileo.error({ title: t("block.failed"), description: err.message }),
    },
  )

  const [unblock, { loading: unblocking }] =
    useMutation<UnblockCustomerResult>(UNBLOCK_CUSTOMER_FROM_AI, {
      refetchQueries: [GET_WHATSAPP_THREAD, GET_WHATSAPP_THREADS],
      onCompleted: () => sileo.success({ title: t("unblock.done") }),
      onError: (err) =>
        sileo.error({ title: t("unblock.failed"), description: err.message }),
    })

  const thread = data?.shopWhatsAppThread?.data ?? null

  useEffect(() => {
    if (thread && !thread.is_read) {
      void markRead({ variables: { conversationId: thread.id } })
    }
  }, [thread?.id, thread?.is_read, markRead])

  /**
   * An email reply is sent by a worker after the mutation has returned, and
   * nothing pushes "it left" to this screen. So while the newest one is still
   * inside its sending window the thread is re-read every few seconds: the
   * bubble turns from "Sending…" to "Sent" by itself, and the polling ends
   * with it — or with the window, after which the bubble says "Not sent yet"
   * and more polling would not change that.
   */
  const pendingSince = thread
    ? newestPendingEmailReplyAt(thread.channel, thread.messages)
    : null
  useEffect(() => {
    if (!pendingSince) return
    const remaining =
      new Date(pendingSince).getTime() +
      EMAIL_REPLY_SENDING_WINDOW_MS -
      Date.now()
    if (!(remaining > 0)) return
    startPolling(EMAIL_REPLY_POLL_MS)
    const giveUp = setTimeout(stopPolling, remaining)
    return () => {
      clearTimeout(giveUp)
      stopPolling()
    }
  }, [pendingSince, startPolling, stopPolling])

  const paused =
    thread?.ai_paused_until !== null &&
    thread?.ai_paused_until !== undefined &&
    new Date(thread.ai_paused_until) > new Date()

  /**
   * Whether an assistant answers this thread at all. No assistant answers a
   * contact-form sender, so "Stop AI replies" there would offer to switch off
   * something that was never on.
   */
  const assistantAnswers = thread?.channel !== "CONTACT_FORM"

  /** A standing instruction, unlike the pause above it. */
  const blocked = assistantAnswers && thread?.is_ai_blocked === true

  /**
   * A nudge, not a verdict.
   *
   * Hidden once the contact is blocked: the chip asks a question the merchant
   * has then already answered, and leaving it up makes it noise they learn to
   * ignore. The server clears it on a block and on a hand-reply for the same
   * reason; this is the same rule rendered.
   */
  const flagged = thread?.flagged_at != null && !blocked

  if (loading && !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="ms-auto h-16 w-1/2" />
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <MessageCircle className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("thread.notFound")}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p dir="ltr" className="font-mono text-sm tabular-nums">
            {thread.phone_masked ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(channelLabelKey(thread.channel))}
          </p>
        </div>
        {/* **This row always renders.** It used to exist only inside the
            `paused` branch, which was fine while a Resume button was the only
            thing in it — but a Block control put there would be invisible on
            every unpaused thread, which is almost all of them. The pause pill
            and Resume stay conditional inside it. */}
        <div className="flex flex-wrap items-center gap-2">
          {paused && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-500/20 ring-inset dark:text-amber-400">
                <Pause className="size-3.5" aria-hidden />
                {t("thread.assistantPaused")}
              </span>
              {/* The way out. Without it the clock is the only thing that ends a
                  pause, so a thread the merchant already resolved stays
                  unanswered for the rest of the day. */}
              <Button
                variant="outline"
                size="sm"
                disabled={resuming}
                onClick={() =>
                  void resume({ variables: { conversationId: threadId } })
                }
              >
                {resuming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4 rtl:rotate-180" />
                )}
                {t("resume.action")}
              </Button>
            </>
          )}

          {blocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 ring-inset">
              <BotOff className="size-3.5" aria-hidden />
              {t("block.badge")}
            </span>
          )}

          {/* **A nudge, and it names the ceiling rather than a verdict.** The
              merchant decides; the server never blocks anybody by itself,
              because a real customer having a bad day looks identical to a
              squatter from its side. */}
          {flagged && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-500/20 ring-inset dark:text-amber-400">
              <TriangleAlert className="size-3.5" aria-hidden />
              {t(`flag.reason.${thread.flag_reason ?? "rate"}`)}
            </span>
          )}

          {/* **The reply box below stays enabled either way**, which is the
              feature rather than an oversight: blocking says "do not spend my
              AI on this person", not "I never want to hear from them". */}
          {assistantAnswers && (
            <Button
              variant="outline"
              size="sm"
              disabled={blocking || unblocking}
              onClick={() =>
                void (blocked
                  ? unblock({ variables: { conversationId: threadId } })
                  : block({ variables: { conversationId: threadId } }))
              }
            >
              {blocking || unblocking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BotOff className="size-4" aria-hidden />
              )}
              {blocked ? t("unblock.action") : t("block.action")}
            </Button>
          )}
        </div>
      </header>
      <ThreadOrders orders={thread.orders} />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {thread.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            emailReply={isEmailReply(thread.channel, message)}
          />
        ))}
      </div>

      {/* A contact-form sender is answered by email, with its own copy and
          its own check that the shop has an address to receive the answer. */}
      {thread.channel === "CONTACT_FORM" ? (
        <ContactReplyBox threadId={threadId} />
      ) : (
        <form
          className="space-y-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            const text = body.trim()
            // Synchronous, unlike `sending`, which disables the button only
            // once React has re-rendered. The server also drops the same text
            // to the same thread inside a minute; this keeps a double-click
            // from asking it to.
            if (!text || replying.current) return
            replying.current = true
            void reply({
              variables: { input: { conversation_id: threadId, body: text } },
            }).finally(() => {
              replying.current = false
            })
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("reply.placeholder")}
            rows={2}
            className="resize-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Stated before they type, not after they send. Taking over is the
                consequence of replying, and a merchant should know it while the
                choice is still theirs. */}
            <p className="text-xs text-muted-foreground">
              {flagged ? t("flag.prompt") : t("reply.takesOver")}
            </p>
            <Button type="submit" size="sm" disabled={sending || !body.trim()}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4 rtl:rotate-180" />
              )}
              {t("reply.send")}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * The "via …" line under the thread's masked identity.
 *
 * Named per channel rather than "contact form, else WhatsApp": Telegram threads
 * share this inbox, and the fallthrough labelled every one of them "via
 * WhatsApp". An unknown channel keeps the WhatsApp wording, the inbox's
 * original and still most common case.
 */
function channelLabelKey(
  channel: string | null | undefined,
): "thread.viaContactForm" | "thread.viaTelegram" | "thread.viaWhatsApp" {
  if (channel === "CONTACT_FORM") return "thread.viaContactForm"
  if (channel === "TELEGRAM") return "thread.viaTelegram"
  return "thread.viaWhatsApp"
}
