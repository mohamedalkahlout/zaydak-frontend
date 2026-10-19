"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Check, ExternalLink, Send } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"

import {
  CONNECT_TELEGRAM_ORDER_UPDATES,
  MY_TELEGRAM_ORDER_UPDATES,
} from "../api"

/**
 * "Get your order updates on Telegram."
 *
 * ## Why this card exists at all
 *
 * A Telegram bot cannot message anybody who has not pressed Start on it, so a
 * shop that switches Telegram notifications on is talking to whoever happens to
 * have opened a chat with it — which, before this, meant almost nobody. This is
 * the only thing that turns the feature on for a customer, and it has to live
 * where a customer is already thinking about an order arriving: the
 * confirmation screen, and the account hub they come back to.
 *
 * ## It renders nothing far more often than it renders something
 *
 * Three states and two of them are silence. A shop with no connected bot has
 * nothing to offer and gets no card — a button that minted a link into a bot
 * with no receiver would be worse than no button, because the customer taps,
 * Telegram opens, and nothing ever answers. A customer already bound gets a
 * one-line confirmation rather than the offer again; without it the same
 * persuasion would sit on the account page forever, having already worked.
 *
 * ## The link is fetched by the press that spends it
 *
 * Not on mount, and not into the Apollo cache. It is a single-use credential
 * that binds a Telegram chat to this account for fifteen minutes, so it is
 * minted by the click, shown once, and held in component state — the same rule
 * the vendor dashboard's pairing card follows, for the same reason: a link that
 * can be re-read is a link that can be found in a screenshot later.
 *
 * Two steps rather than one, and that is deliberate too. Navigating straight to
 * `t.me` inside the mutation's `onCompleted` is a popup after an await, which
 * browsers block; and on the confirmation screen it would take the customer off
 * their brand-new order. So the press mints, and the link that appears is an
 * ordinary anchor the customer decides to follow.
 */
export function TelegramUpdatesCard() {
  const t = useTranslations("telegramUpdates")
  const [link, setLink] = useState<{ url: string; expires_in: number } | null>(
    null,
  )

  /*
    `cache-and-network`: a customer who opts in on one tab and comes back to
    another should not be offered it again. Errors are swallowed to `null` —
    this is an optional extra beside an order, and a failed side query must not
    put an error on a screen whose subject is somewhere else entirely.
  */
  const { data } = useQuery(MY_TELEGRAM_ORDER_UPDATES, {
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  })

  const [connect, { loading }] = useMutation(CONNECT_TELEGRAM_ORDER_UPDATES, {
    onCompleted: (res) => {
      // Null is the race: the query said available, the merchant disconnected
      // the bot in between. Worded here rather than carried from the back-end,
      // whose own "not configured" message is about the platform.
      if (!res.connectTelegramOrderUpdates) {
        sileo.error({ title: t("unavailable") })
        return
      }
      setLink(res.connectTelegramOrderUpdates)
    },
    onError: (err) =>
      sileo.error({ title: t("failed"), description: err.message }),
  })

  const status = data?.myTelegramOrderUpdates
  if (!status?.available) return null

  if (status.linked) {
    return (
      <section className="shop-panel flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
        >
          <Check className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          {status.bot_username
            ? t("linkedTo", { bot: `@${status.bot_username}` })
            : t("linked")}
        </p>
      </section>
    )
  }

  return (
    <section className="shop-panel space-y-3 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
        >
          <Send className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-medium tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
        </div>
      </div>

      {link ? (
        /*
          The minted link. `noopener` because `t.me` is somebody else's origin,
          and `dir="ltr"` on the handle because a bare Latin URL inside an
          Arabic paragraph otherwise reorders around its punctuation.
        */
        <div className="space-y-2">
          <Button
            size="sm"
            className="rounded-full"
            nativeButton={false}
            render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="size-4" />
            {t("open")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("expires", { minutes: Math.round(link.expires_in / 60) })}
          </p>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
          disabled={loading}
          onClick={() => void connect()}
        >
          <Send className="size-4" />
          {status.bot_username
            ? t("connectTo", { bot: `@${status.bot_username}` })
            : t("connect")}
        </Button>
      )}
    </section>
  )
}
