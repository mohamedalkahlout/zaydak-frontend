"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useFormatter, useNow, useTranslations } from "next-intl"
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Unplug,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { WhatsAppStatusPill } from "@/features/whatsapp/components/whatsapp-status-pill"
import {
  CONNECT_TELEGRAM_BOT,
  DISCONNECT_TELEGRAM_BOT,
  GET_MY_TELEGRAM_BOT,
} from "../api"
import type {
  ConnectTelegramBotResult,
  DisconnectTelegramBotResult,
  TelegramPairingLink,
  TelegramVendorLinkResult,
} from "../types"

/**
 * The Zaydak assistant on Telegram.
 *
 * **The pairing link lives in component state and nowhere else.** Not the
 * Apollo cache, not a store, not the URL. It is a one-time credential: whoever
 * opens it binds *their* Telegram account to this vendor's Zaydak account. So
 * it is fetched only by the click that will use it, shown once, and forgotten
 * on unmount — pressing Connect again mints a fresh one rather than re-showing
 * this one, because a link that can be re-read is a link that can be found in
 * a screenshot an hour later.
 *
 * The consent line sits above the button rather than in a footnote, for the
 * same reason the WhatsApp screen puts its QR consent there: this is a moment
 * where the vendor grants something, and a footnote is where people do not
 * look.
 */
export function TelegramVendorBotCard() {
  const t = useTranslations("settings.telegram.vendorBot")
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })

  const [link, setLink] = useState<TelegramPairingLink | null>(null)

  const { data, loading, refetch } = useQuery<TelegramVendorLinkResult>(
    GET_MY_TELEGRAM_BOT,
    { fetchPolicy: "cache-and-network" },
  )

  const [connect, { loading: connecting }] =
    useMutation<ConnectTelegramBotResult>(CONNECT_TELEGRAM_BOT, {
      onCompleted: (res) => setLink(res.connectTelegramBot),
      onError: (err) =>
        sileo.error({ title: t("toast.connectFailed"), description: err.message }),
    })

  const [disconnect, { loading: disconnecting }] =
    useMutation<DisconnectTelegramBotResult>(DISCONNECT_TELEGRAM_BOT, {
      onCompleted: () => {
        setLink(null)
        sileo.success({ title: t("toast.disconnected") })
        void refetch()
      },
      onError: (err) =>
        sileo.error({
          title: t("toast.disconnectFailed"),
          description: err.message,
        }),
    })

  const status = data?.myTelegramBot
  const configured = Boolean(status?.bot_username)
  const linked = status?.linked ?? false

  if (loading && !data) {
    return (
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-3 h-16 w-full" />
      </section>
    )
  }

  const tone = !configured ? "fault" : linked ? "live" : "off"
  const pillLabel = !configured
    ? t("unavailable")
    : linked
      ? t("connected")
      : t("notConnected")

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      sileo.success({ title: t("toast.copied") })
    } catch {
      sileo.error({ title: t("toast.copyFailed") })
    }
  }

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground/70 ring-1 ring-foreground/10 ring-inset"
          >
            <Bot className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-base leading-snug font-medium">
              {t("title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <WhatsAppStatusPill tone={tone} label={pillLabel} />
      </div>

      <div className="space-y-4 px-4 pb-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("body")}
        </p>

        {/* The bot's handle, labelled as the platform's. The label is doing
            real work: an unlabelled handle on a Telegram settings screen reads
            as the shop's own, which is the one misreading this card exists to
            prevent. */}
        {configured && status?.bot_username && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("botLabel")}
            </span>
            <span dir="ltr" className="font-mono text-sm">
              @{status.bot_username}
            </span>
          </div>
        )}

        {/* Not the vendor's fault and not theirs to fix. Said plainly, with no
            button that would mint a link with nowhere to go. */}
        {!configured && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            {t("notConfigured")}
          </p>
        )}

        {/* Which Telegram account can write. That it answers about *this*
            store is stated rather than assumed: an answer about the wrong shop
            is the one mistake a vendor would never think to check for. */}
        {linked && status && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-500/5 p-3 ring-1 ring-emerald-500/20 ring-inset">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {status.telegram_username
                  ? t("linkedAs", { handle: `@${status.telegram_username}` })
                  : t("linkedAnon")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("answersHere")}
              </p>
              {status.linked_at && (
                <p className="text-xs text-muted-foreground">
                  {t("linkedAt", {
                    when: format.relativeTime(new Date(status.linked_at), now),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* The freshly minted link. Shown once, held in state, and gone on
            unmount. "Open" goes straight to the chat with `/start` prefilled;
            "Copy" is for the vendor whose Telegram is on another device. */}
        {!linked && link && (
          <div className="space-y-3 rounded-lg bg-muted/60 p-3">
            <p className="text-sm font-medium">{t("linkReady")}</p>
            <p
              dir="ltr"
              className="truncate font-mono text-xs text-muted-foreground"
              data-testid="telegram-pairing-url"
            >
              {link.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <a href={link.url} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="size-4" />
                {t("openLink")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Copy className="size-4" />
                {t("copyLink")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("linkExpires", { minutes: Math.round(link.expires_in / 60) })}
            </p>
          </div>
        )}

        {/* Consent above the button, then the button. */}
        {configured && !linked && !link && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("consent")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {configured && !linked && !link && (
            <Button
              size="sm"
              disabled={connecting}
              onClick={() => void connect()}
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              {t("connect")}
            </Button>
          )}

          {configured && linked && status?.bot_username && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={`https://t.me/${status.bot_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="size-4" />
              {t("open")}
            </Button>
          )}

          {/* Disconnecting is a ghost button rather than a destructive one:
              pressing Connect again re-links in a minute, so nothing here is
              permanent and red would misrepresent what it costs. */}
          {linked && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disconnecting}
              onClick={() => void disconnect()}
            >
              {disconnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unplug className="size-4" />
              )}
              {t("disconnect")}
            </Button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("readOnly")}
        </p>
      </div>
    </section>
  )
}
