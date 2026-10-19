"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useFormatter, useNow, useTranslations } from "next-intl"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Store,
  Unplug,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Skeleton } from "@repo/ui/components/skeleton"
import { useFeature } from "@/features/plan/lib/use-feature"
import { WhatsAppBotOffDialog } from "@/features/whatsapp/components/whatsapp-bot-off-dialog"
import { WhatsAppCustomerBotCard } from "@/features/whatsapp/components/whatsapp-customer-bot-card"
import { WhatsAppOrdersOnDialog } from "@/features/whatsapp/components/whatsapp-orders-on-dialog"
import { WhatsAppStatusPill } from "@/features/whatsapp/components/whatsapp-status-pill"
import {
  CONNECT_SHOP_TELEGRAM_BOT,
  DISCONNECT_SHOP_TELEGRAM_BOT,
  GET_MY_SHOP_TELEGRAM_BOT,
  SET_SHOP_TELEGRAM_CUSTOMER_BOT,
  SET_SHOP_TELEGRAM_CUSTOMER_BOT_ORDERS,
  SYNC_SHOP_TELEGRAM_WEBHOOK,
} from "../api"
import type {
  ConnectShopTelegramBotResult,
  DisconnectShopTelegramBotResult,
  SetShopTelegramCustomerBotOrdersResult,
  SetShopTelegramCustomerBotResult,
  ShopTelegramBotResult,
  SyncShopTelegramWebhookResult,
} from "../types"

/**
 * The copy the assistant card and its confirm read. Same tree shape as
 * `settings.whatsapp.bot`, worded for a bot rather than a number.
 */
const BOT_NAMESPACE = "settings.telegram.shopBot.bot"

/**
 * The shape BotFather prints: `<bot id>:<secret>`. Mirrors the server's DTO,
 * so a pasted `@username`, a `t.me` link, or the token with its surrounding
 * sentence is refused before a request leaves the browser.
 */
const TOKEN_SHAPE = /^\d{5,}:[A-Za-z0-9_-]{30,}$/

/**
 * Telegram's own words for a failure, when the server passed them through.
 *
 * `formatError` puts a provider's response in `extensions.detail`; the
 * message itself is only the translated error code, and "Telegram refused
 * that bot token" is not what tells a merchant whether the token was wrong or
 * their tunnel was down.
 */
function detailOf(err: unknown): string | undefined {
  const e = err as {
    errors?: Array<{ extensions?: { detail?: unknown } }>
    graphQLErrors?: Array<{ extensions?: { detail?: unknown } }>
  }
  const d =
    e.errors?.[0]?.extensions?.detail ??
    e.graphQLErrors?.[0]?.extensions?.detail
  return typeof d === "string" && d ? d : undefined
}

/**
 * The shop's own Telegram bot — the one its customers write to.
 *
 * **The token is typed here and exists nowhere else on this screen.** The
 * server never returns it, masked or otherwise (the bot's `@username` is what
 * says which bot is connected), so there is no form to seed, nothing for a
 * save bar to stage, and nothing for a screenshot to leak. Pasting it and
 * pressing Connect is a consent moment like the WhatsApp scan, not an edit:
 * the server asks Telegram whose token it is *before* storing anything, and
 * answers with Telegram's reason when it is refused.
 *
 * **Not connected is two states, and the card tells them apart.** No bot at
 * all, and a bot Telegram accepted whose webhook it then refused — the row is
 * kept with Telegram's own words in `last_error` so the merchant reads *why*
 * (a dead tunnel, a plan limit) rather than "not connected". That state has
 * two ways out, and the cheaper one comes first: **Retry registration** asks
 * the server to register the webhook again from the token it already holds,
 * because what usually broke is on our side (the tunnel, the callback origin)
 * and the token in BotFather is unchanged. Pasting again is for when it is
 * not.
 *
 * **The assistant switch is the WhatsApp card, verbatim.** Once the bot is
 * connected, the same `WhatsAppCustomerBotCard` and the same off-confirm sit
 * under the connection block, reading their copy from
 * `settings.telegram.shopBot.bot`. Same rules, same reasons: the default is
 * off, the first visit after connecting leads with a question rather than a
 * settled switch, "not now" needs no confirmation and flipping a live switch
 * off does. The answer is remembered in component state only — a reload shows
 * the settled card, and a merchant who reloaded has already seen the question.
 *
 * **Taking orders is the WhatsApp switch too**, under a live assistant: on is
 * confirmed, off never is, and a plan without `ai.agent.checkout` can turn it
 * off but not on. Turning it on also re-registers the bot's webhook so the
 * summary's confirm button can be pressed, so a refusal there comes back in
 * Telegram's words, like a refused connect.
 */
export function TelegramShopBotCard() {
  const t = useTranslations("settings.telegram.shopBot")
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })

  const [token, setToken] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [turningBotOff, setTurningBotOff] = useState(false)
  const [turningOrdersOn, setTurningOrdersOn] = useState(false)

  /** Whether the plan includes taking orders in the chat. */
  const ordersFeature = useFeature("ai.agent.checkout")

  /**
   * Whether this visit has already answered the assistant question. The row
   * cannot tell "never asked" from "asked, and they said no" — both are
   * `ai_enabled: false` — and the distinction only matters for the moments
   * after connecting, so it lives here and nowhere else.
   */
  const [botAnswered, setBotAnswered] = useState(false)

  const { data, loading, refetch } = useQuery<ShopTelegramBotResult>(
    GET_MY_SHOP_TELEGRAM_BOT,
    { fetchPolicy: "cache-and-network" },
  )

  const [connect, { loading: connecting }] =
    useMutation<ConnectShopTelegramBotResult>(CONNECT_SHOP_TELEGRAM_BOT, {
      onCompleted: () => {
        setToken("")
        sileo.success({ title: t("toast.connected") })
        void refetch()
      },
      onError: (err) => {
        sileo.error({
          title: t("toast.connectFailed"),
          description: detailOf(err) ?? err.message,
        })
        // A refused webhook leaves a row carrying the reason. Re-read so the
        // card shows it rather than only the toast that just went by.
        void refetch()
      },
    })

  const [disconnect, { loading: disconnecting }] =
    useMutation<DisconnectShopTelegramBotResult>(DISCONNECT_SHOP_TELEGRAM_BOT, {
      onCompleted: () => {
        setConfirming(false)
        sileo.success({ title: t("toast.disconnected") })
        void refetch()
      },
      onError: (err) =>
        sileo.error({
          title: t("toast.disconnectFailed"),
          description: err.message,
        }),
    })

  const [sync, { loading: syncing }] =
    useMutation<SyncShopTelegramWebhookResult>(SYNC_SHOP_TELEGRAM_WEBHOOK, {
      onCompleted: () => {
        sileo.success({ title: t("toast.retried") })
        void refetch()
      },
      onError: (err) => {
        sileo.error({
          title: t("toast.retryFailed"),
          description: detailOf(err) ?? err.message,
        })
        // The server wrote Telegram's newest reason into `last_error` before
        // answering; re-read so the box shows that one, not the previous.
        void refetch()
      },
    })

  const [setBot, { loading: savingBot }] =
    useMutation<SetShopTelegramCustomerBotResult>(
      SET_SHOP_TELEGRAM_CUSTOMER_BOT,
      {
        onError: (err) =>
          sileo.error({
            title: t("bot.toast.failed"),
            description: err.message,
          }),
      },
    )

  const [setOrders, { loading: savingOrders }] =
    useMutation<SetShopTelegramCustomerBotOrdersResult>(
      SET_SHOP_TELEGRAM_CUSTOMER_BOT_ORDERS,
      {
        onError: (err) => {
          sileo.error({
            title: t("bot.orders.toast.failed"),
            description: detailOf(err) ?? err.message,
          })
          // A refused re-registration marks the bot disconnected with the
          // reason; re-read so the card shows it.
          void refetch()
        },
      },
    )

  const bot = data?.myShopTelegramBot

  const answerOrders = async (enabled: boolean) => {
    const res = await setOrders({ variables: { enabled } })
    if (res.data?.setShopTelegramCustomerBotOrders) {
      sileo.success({
        title: t(
          enabled ? "bot.orders.toast.enabled" : "bot.orders.toast.disabled",
        ),
      })
      void refetch()
    }
  }

  const answerBot = async (enabled: boolean) => {
    setBotAnswered(true)
    const res = await setBot({ variables: { enabled } })
    if (res.data?.setShopTelegramCustomerBot) {
      sileo.success({
        title: t(enabled ? "bot.toast.enabled" : "bot.toast.disabled"),
      })
      void refetch()
    }
  }
  const connected = bot?.connected ?? false
  const attention =
    !connected && Boolean(bot?.bot_username) && Boolean(bot?.last_error)

  if (loading && !data) {
    return (
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-3 h-24 w-full" />
      </section>
    )
  }

  const tone = connected ? "live" : attention ? "fault" : "off"
  const pillLabel = connected
    ? t("connected")
    : attention
      ? t("attention")
      : t("notConnected")
  const valid = TOKEN_SHAPE.test(token.trim())

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground/70 ring-1 ring-foreground/10 ring-inset"
          >
            <Store className="size-5" />
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

        {/* Connected: the handle, labelled as the store's own — the one
            misreading a Telegram settings screen invites is that a handle is
            Zaydak's, and the card above this one is exactly that. */}
        {connected && bot && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("botLabel")}
              </span>
              <span dir="ltr" className="font-mono text-sm">
                @{bot.bot_username}
              </span>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-emerald-500/5 p-3 ring-1 ring-emerald-500/20 ring-inset">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {t("connectedAs", { handle: `@${bot.bot_username}` })}
                </p>
                {bot.last_ok_at && (
                  <p className="text-xs text-muted-foreground">
                    {t("connectedAt", {
                      when: format.relativeTime(new Date(bot.last_ok_at), now),
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`https://t.me/${bot.bot_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="size-4" />
                {t("open")}
              </Button>

              {/* Disconnecting goes through a confirmation, unlike the
                  assistant card's: reconnecting needs the token again, which
                  the merchant may not have to hand. */}
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnecting}
                onClick={() => setConfirming(true)}
              >
                <Unplug className="size-4" />
                {t("disconnect")}
              </Button>
            </div>
          </>
        )}

        {/* The refused webhook, in Telegram's words. Shown above the form so
            the reason is read before the token is pasted again. */}
        {attention && bot?.last_error && (
          <div
            className="flex items-start gap-3 rounded-lg bg-amber-500/5 p-3 ring-1 ring-amber-500/20 ring-inset"
            data-testid="telegram-shop-bot-error"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{t("errorTitle")}</p>
              <p dir="ltr" className="font-mono text-xs break-words text-muted-foreground">
                {bot.last_error}
              </p>
              <p className="text-xs text-muted-foreground">{t("errorHint")}</p>
            </div>
          </div>
        )}

        {!connected && (
          <>
            <div className="space-y-2 rounded-lg bg-muted/60 p-3">
              <p className="text-sm font-medium">{t("steps.title")}</p>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                <li>{t("steps.one")}</li>
                <li>{t("steps.two")}</li>
                <li>{t("steps.three")}</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telegram-shop-token">{t("tokenLabel")}</Label>
              <Input
                id="telegram-shop-token"
                type="password"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder={t("tokenPlaceholder")}
                value={token}
                disabled={connecting}
                onChange={(e) => setToken(e.target.value)}
                aria-invalid={token.length > 0 && !valid ? true : undefined}
                data-testid="telegram-shop-token"
              />
              <p className="text-xs text-muted-foreground">{t("tokenHint")}</p>
            </div>

            {/* Consent above the button, then the button. */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("consent")}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={!valid || connecting || syncing}
                onClick={() =>
                  void connect({
                    variables: { input: { bot_token: token.trim() } },
                  })
                }
              >
                {connecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                {t(attention ? "reconnect" : "connect")}
              </Button>

              {/* Only while a refused row exists: there is a sealed token to
                  retry from, and no token to ask for. Enabled regardless of
                  what is in the field above — the field is for the *other*
                  way out. */}
              {attention && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncing || connecting}
                  onClick={() => void sync()}
                  data-testid="telegram-shop-bot-retry"
                >
                  {syncing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {t("retry")}
                </Button>
              )}
            </div>
            {attention && (
              <p className="text-xs text-muted-foreground">{t("retryHint")}</p>
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("inboxNote")}
        </p>

        {/* The assistant card appears only once there is a bot for it to
            answer on. Offering the switch beside a refused webhook would be
            asking a merchant to configure something that cannot run. */}
        {connected && bot && (
          <WhatsAppCustomerBotCard
            namespace={BOT_NAMESPACE}
            enabled={bot.ai_enabled}
            undecided={!botAnswered && !bot.ai_enabled}
            saving={savingBot}
            onEnable={() => void answerBot(true)}
            onDisable={() =>
              // The ask's "not now" needs no confirmation — it is already an
              // answer to a question. Only flipping a *live* switch off does,
              // because that change is invisible from the merchant's side and
              // they find out from a customer.
              bot.ai_enabled ? setTurningBotOff(true) : void answerBot(false)
            }
            orders={{
              enabled: bot.ai_orders_enabled ?? false,
              allowed: ordersFeature.allowed,
              loading: ordersFeature.loading,
              saving: savingOrders,
              // On is confirmed — it lets orders appear that the merchant
              // never saw being made. Off is the safe direction and is not.
              onEnable: () => setTurningOrdersOn(true),
              onDisable: () => void answerOrders(false),
            }}
          />
        )}
      </div>

      <WhatsAppOrdersOnDialog
        namespace={BOT_NAMESPACE}
        open={turningOrdersOn}
        saving={savingOrders}
        onOpenChange={setTurningOrdersOn}
        onConfirm={async () => {
          await answerOrders(true)
          setTurningOrdersOn(false)
        }}
      />

      <WhatsAppBotOffDialog
        namespace={BOT_NAMESPACE}
        open={turningBotOff}
        saving={savingBot}
        onOpenChange={setTurningBotOff}
        onConfirm={async () => {
          await answerBot(false)
          setTurningBotOff(false)
        }}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDisconnect.title")}</DialogTitle>
            <DialogDescription>{t("confirmDisconnect.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("confirmDisconnect.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={disconnecting}
              onClick={() => void disconnect()}
            >
              {disconnecting && <Loader2 className="size-4 animate-spin" />}
              {t("confirmDisconnect.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
