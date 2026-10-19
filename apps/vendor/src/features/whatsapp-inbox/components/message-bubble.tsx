"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { Bot, Store, User } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { emailReplyDelivery } from "../lib/delivery"
import type { InboxMessage, InboxSender } from "../types"

/**
 * How each of the three voices is drawn.
 *
 * **The AI is not styled as the merchant**, and that separation is the whole
 * reason this screen exists. Both replies leave the shop and both carry no user
 * on this channel, so if they looked alike a merchant scrolling the thread
 * could not tell what they said from what was said for them — which is the one
 * question the inbox is here to answer.
 *
 * So the two shop-side voices share a side (right, as the sender always is) but
 * never a colour: the merchant's own words are solid, the assistant's are a
 * tinted outline with its name on them. The customer sits on the left in the
 * neutral surface every chat uses for the other party.
 */
const VOICES: Record<
  InboxSender,
  { align: string; bubble: string; icon: typeof User; label: string }
> = {
  CUSTOMER: {
    align: "justify-start",
    bubble: "bg-muted text-foreground rounded-bl-sm",
    icon: User,
    label: "customer",
  },
  AI: {
    align: "justify-end",
    // Outlined rather than filled: it is the shop talking, but not the person.
    bubble:
      "bg-primary/5 text-foreground rounded-br-sm ring-1 ring-primary/25 ring-inset",
    icon: Bot,
    label: "ai",
  },
  VENDOR: {
    align: "justify-end",
    bubble: "bg-primary text-primary-foreground rounded-br-sm",
    icon: Store,
    label: "vendor",
  },
}

export function MessageBubble({
  message,
  emailReply = false,
}: {
  message: InboxMessage
  /**
   * This bubble is a merchant's reply that went out by email, so it says
   * whether the email has left. Decided by the thread (`isEmailReply`), never
   * here: on every other kind of message a null `sent_at` means nothing.
   */
  emailReply?: boolean
}) {
  const t = useTranslations("whatsappInbox.voice")
  const td = useTranslations("whatsappInbox.delivery")
  const format = useFormatter()
  // A reply still on its way keeps reading the clock, so "Sending…" turns into
  // "Not sent yet" by itself when its window runs out. Every other bubble
  // reads it once: `dateTime` needs no anchor.
  const now = useNow(
    emailReply && !message.sent_at ? { updateInterval: 15_000 } : undefined,
  )
  const delivery = emailReply
    ? emailReplyDelivery(message, now.getTime())
    : null

  const voice = VOICES[message.sender] ?? VOICES.CUSTOMER
  const Icon = voice.icon

  return (
    <div className={cn("flex", voice.align)}>
      <div className="max-w-[85%] space-y-1 sm:max-w-[70%]">
        {/* The label is on every bubble, not only the assistant's. Naming one
            voice and leaving the others bare would read as an exception rather
            than as a thread with three participants in it. */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            message.sender === "CUSTOMER" ? "" : "justify-end",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          <span>{t(voice.label)}</span>
          <span aria-hidden>·</span>
          <time dateTime={message.created_at}>
            {format.dateTime(new Date(message.created_at), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {/* Quiet on purpose: the same muted line as the time, and amber only
              for the one state the merchant has to act on. "Sent" is handed to
              the mail server, not delivered — the hint says so. */}
          {delivery && (
            <>
              <span aria-hidden>·</span>
              <span
                title={td(`${delivery}Hint`)}
                className={cn(
                  delivery === "unsent" && "text-amber-700 dark:text-amber-400",
                )}
              >
                {td(delivery)}
              </span>
            </>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            // `whitespace-pre-wrap`: a merchant typing an address or a list
            // means those line breaks, and WhatsApp delivered them.
            "break-words whitespace-pre-wrap",
            voice.bubble,
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  )
}
