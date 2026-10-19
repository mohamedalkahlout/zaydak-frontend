"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Loader2, Mail, SendHorizontal, Settings } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Textarea } from "@repo/ui/components/textarea"
import { NOTIFICATION_SETTING } from "@/features/notifications/api"
import type { NotificationSettingResult } from "@/features/notifications/types"
import { sectionUrl } from "@/features/settings/lib/routes"
import {
  GET_WHATSAPP_THREAD,
  GET_WHATSAPP_THREADS,
  REPLY_TO_WHATSAPP_THREAD,
} from "../api"
import type { ReplyResult } from "../types"

/**
 * The reply box under a contact-form thread: the answer goes out by email.
 *
 * **The email is sent from the platform's address, in the store's name, and
 * the customer's answer goes to the shop's sender email** from notification
 * settings — not back into this inbox, which has no inbound email. So the box
 * names that address before anything is typed, warns when it is unverified
 * (a typo there sends the customer's answer to a stranger), and is replaced by
 * a link to Settings → Notifications when there is none, because the server
 * refuses a reply nobody could answer.
 *
 * Its own component so the thread view's hook order stays the same on every
 * channel: the settings read happens only on the thread that needs it.
 *
 * Nothing here pauses the assistant, and nothing says it does — no assistant
 * answers this channel.
 */
export function ContactReplyBox({ threadId }: { threadId: string }) {
  const t = useTranslations("whatsappInbox")
  const { shopSlug } = useParams<{ shopSlug: string }>()
  const [body, setBody] = useState("")
  /** A reply is in flight; see the submit handler. */
  const replying = useRef(false)

  const { data, loading, error } = useQuery<NotificationSettingResult>(
    NOTIFICATION_SETTING,
    // The address can change in another tab while this one is open, and the
    // hint is a promise about where the customer's answer goes.
    { fetchPolicy: "cache-and-network" },
  )

  const [reply, { loading: sending }] = useMutation<ReplyResult>(
    REPLY_TO_WHATSAPP_THREAD,
    {
      refetchQueries: [GET_WHATSAPP_THREAD, GET_WHATSAPP_THREADS],
      onCompleted: () => {
        setBody("")
        // Queued, not delivered: a worker sends it after this returns.
        sileo.success({ title: t("reply.emailQueued") })
      },
      onError: (err) =>
        sileo.error({ title: t("reply.failed"), description: err.message }),
    },
  )

  const setting = data?.notificationSetting?.data
  const sender = setting?.sender_email?.trim() || null

  if (loading && !data) {
    return (
      <div className="border-t border-border p-3">
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  // A failed settings read is not a reason to hide the box: the server is the
  // one that refuses, and it says why.
  if (!sender && !error) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-border bg-muted/20 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          {t("reply.contactFormNeedsSender")}
        </p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={sectionUrl(shopSlug ?? null, "notifications")} />}
        >
          <Settings className="size-4" aria-hidden />
          {t("reply.contactFormSettingsLink")}
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-2 border-t border-border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        const text = body.trim()
        // Each send is an email from our domain that spends the shop's
        // ceilings, so a double-click must not ask twice. `sending` disables
        // the button only after a re-render; this is synchronous. The server
        // drops the same text to the same thread inside a minute as well.
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
        rows={3}
        className="resize-none"
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {sender && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {t.rich("reply.contactFormHint", {
                  email: sender,
                  addr: (chunks) => (
                    <bdi dir="ltr" className="font-medium text-foreground">
                      {chunks}
                    </bdi>
                  ),
                })}
              </span>
            </p>
          )}
          {sender && setting?.sender_verified === false && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("reply.contactFormUnverified")}
            </p>
          )}
        </div>
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
  )
}
