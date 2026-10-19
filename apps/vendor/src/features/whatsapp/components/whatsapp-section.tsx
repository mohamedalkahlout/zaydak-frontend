"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Skeleton } from "@repo/ui/components/skeleton"
import { useFeature } from "@/features/plan/lib/use-feature"
import {
  CONNECT_WHATSAPP,
  GET_MY_WHATSAPP_INSTANCE,
  SET_WHATSAPP_CUSTOMER_BOT,
  SET_WHATSAPP_CUSTOMER_BOT_ORDERS,
} from "../api"
import { connectionState, watchable } from "../lib/connection"
import type {
  ConnectWhatsAppResult,
  SetCustomerBotOrdersResult,
  SetCustomerBotResult,
  WhatsAppHandshake,
  WhatsAppStatusResult,
} from "../types"
import { useWhatsAppLiveStatus } from "../use-whatsapp-live-status"
import { WhatsAppAccountCard } from "./whatsapp-account-card"
import { WhatsAppBotOffDialog } from "./whatsapp-bot-off-dialog"
import { WhatsAppCustomerBotCard } from "./whatsapp-customer-bot-card"
import { WhatsAppDisconnectDialog } from "./whatsapp-disconnect-dialog"
import { WhatsAppEmptyState } from "./whatsapp-empty-state"
import { WhatsAppOrdersOnDialog } from "./whatsapp-orders-on-dialog"
import { WhatsAppPairingDialog } from "./whatsapp-pairing-dialog"
import { WhatsAppTestDialog } from "./whatsapp-test-dialog"
import { WhatsAppVendorBotCard } from "./whatsapp-vendor-bot-card"

/**
 * Settings → WhatsApp.
 *
 * **Two numbers live on this page and they are never the same number.** The
 * first is the shop's own, which the merchant pairs and their *customers*
 * write to. The second is Zaydak's, which the platform owns, the merchant
 * never pairs, and *they* write to. Everything about the layout exists to keep
 * those apart: they are under separate headings, they never share a card, and
 * only the first one has connection controls. A merchant who conflates them
 * gives a customer the wrong number.
 *
 * Within the shop's half the screen is built around two things being true at
 * once. Linking is a **consent moment**, not a settings toggle: scanning the
 * code links this platform as a device on the vendor's WhatsApp, which grants
 * access to every conversation on the account, not only the ones about their
 * shop. So the consent text is above the button rather than in a footnote, and
 * no code is fetched until the button is pressed. And disconnection is
 * **routine, not an error** — the phone goes flat, devices get unlinked,
 * WhatsApp drops an idle session after about a fortnight — so "Disconnected"
 * is a normal state with a way out, never a red failure.
 *
 * The customer assistant is a separate card and a separate decision from
 * either. Pairing a number does not switch it on, and the ask lands *after* a
 * successful scan rather than being folded into it: a bot enabled by the act
 * of connecting means the first a merchant hears of it is a customer getting
 * an answer they never wrote.
 */
export function WhatsAppSection() {
  const t = useTranslations("settings.whatsapp")

  /**
   * The handshake the connect mutation returned, and the flag that the pairing
   * dialog is open. One piece of state, not two: the dialog only ever opens
   * with a code in hand, and holding it here rather than re-fetching is what
   * puts the QR on screen in the first frame — a second request would mint a
   * *different* code and invalidate the one being rendered.
   *
   * Component state and nothing else. Not the cache, not a store, not the URL:
   * whoever holds this string can link their own device to the vendor's
   * WhatsApp account.
   */
  const [pairing, setPairing] = useState<WhatsAppHandshake | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [turningBotOff, setTurningBotOff] = useState(false)
  const [turningOrdersOn, setTurningOrdersOn] = useState(false)

  /** Whether the plan includes taking orders in the chat. */
  const ordersFeature = useFeature("ai.agent.checkout")

  /**
   * Whether this visit has already answered the assistant question.
   *
   * `ai_enabled: false` is genuinely ambiguous — it is both "never asked" and
   * "asked, and they said no" — and the row has nothing that separates them.
   * Rather than add a column for a distinction that only matters for the few
   * seconds after a scan, the screen remembers the answer for as long as it is
   * on screen: the ask is shown once, and answering it either way settles the
   * card into its switch. A reload shows the settled card, which is the right
   * outcome — a merchant who reloaded has already seen the question.
   */
  const [botAnswered, setBotAnswered] = useState(false)

  const { data, loading, refetch } = useQuery<WhatsAppStatusResult>(
    GET_MY_WHATSAPP_INSTANCE,
    // The row is reconciled against Evolution on every read, so a status that
    // went stale while the tab sat open is corrected by asking again — never
    // from a cache that cannot know the phone died.
    { fetchPolicy: "cache-and-network" },
  )

  const [connect, { loading: connecting }] =
    useMutation<ConnectWhatsAppResult>(CONNECT_WHATSAPP)

  const [setBot, { loading: savingBot }] = useMutation<SetCustomerBotResult>(
    SET_WHATSAPP_CUSTOMER_BOT,
    {
      onError: (err) =>
        sileo.error({ title: t("bot.toast.failed"), description: err.message }),
    },
  )

  const [setOrders, { loading: savingOrders }] =
    useMutation<SetCustomerBotOrdersResult>(SET_WHATSAPP_CUSTOMER_BOT_ORDERS, {
      onError: (err) =>
        sileo.error({
          title: t("bot.orders.toast.failed"),
          description: err.message,
        }),
    })

  const payload = data?.myWhatsAppInstance.data
  const available = payload?.available ?? false
  const instance = payload?.instance ?? null
  const state = connectionState(available, instance)

  /** Re-read the real status from the server. */
  const reread = useCallback(() => {
    void refetch()
  }, [refetch])

  // Real-time connection updates, so `connected → disconnected` reaches an
  // open tab without a refresh. Off while the pairing dialog is up: that
  // dialog runs its own subscription on the same channel, and two streams for
  // one shop would spend the endpoint's per-shop connection budget on itself.
  useWhatsAppLiveStatus({
    enabled: watchable(state) && !pairing,
    onChange: reread,
  })

  const startPairing = useCallback(async () => {
    // The code is minted here and nowhere else — pressing the button *is* the
    // consent, so nothing is fetched before it.
    const res = await connect()
    const shake = res.data?.connectWhatsApp.data
    if (shake) setPairing(shake)
  }, [connect])

  const answerBot = useCallback(
    async (enabled: boolean) => {
      setBotAnswered(true)
      const res = await setBot({ variables: { enabled } })
      if (res.data?.setWhatsAppCustomerBot.success) {
        sileo.success({
          title: t(enabled ? "bot.toast.enabled" : "bot.toast.disabled"),
        })
        void refetch()
      }
    },
    [setBot, refetch, t],
  )

  const answerOrders = useCallback(
    async (enabled: boolean) => {
      const res = await setOrders({ variables: { enabled } })
      if (res.data?.setWhatsAppCustomerBotOrders.success) {
        sileo.success({
          title: t(
            enabled ? "bot.orders.toast.enabled" : "bot.orders.toast.disabled",
          ),
        })
        void refetch()
      }
    },
    [setOrders, refetch, t],
  )

  if (loading && !data) return <WhatsAppSkeleton />

  return (
    <div className="space-y-8">
      {/* ── The shop's own number ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading
          title={t("group.store.title")}
          description={t("group.store.description")}
        />

        {state === "unavailable" || state === "never" ? (
          <WhatsAppEmptyState
            available={available}
            connecting={connecting}
            onConnect={() => void startPairing()}
          />
        ) : (
          <>
            <WhatsAppAccountCard
              state={state}
              instance={instance}
              connecting={connecting}
              refreshing={loading}
              onConnect={() => void startPairing()}
              onRefresh={reread}
              onDisconnect={() => setDisconnecting(true)}
              onTest={() => setTesting(true)}
            />

            {/* The assistant card appears only once there is a number for it
                to answer on. Offering the switch beside a dead session would
                be asking a merchant to configure something that cannot run. */}
            {state === "connected" && (
              <WhatsAppCustomerBotCard
                enabled={instance?.ai_enabled ?? false}
                undecided={!botAnswered && !instance?.ai_enabled}
                saving={savingBot}
                onEnable={() => void answerBot(true)}
                onDisable={() =>
                  // The ask's "not now" needs no confirmation — it is already
                  // an answer to a question. Only flipping a *live* switch off
                  // does, because that change is invisible from the merchant's
                  // side and they find out from a customer.
                  instance?.ai_enabled
                    ? setTurningBotOff(true)
                    : void answerBot(false)
                }
                orders={{
                  enabled: instance?.ai_orders_enabled ?? false,
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
          </>
        )}
      </div>

      {/* ── The platform's number ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading
          title={t("group.assistant.title")}
          description={t("group.assistant.description")}
        />
        <WhatsAppVendorBotCard />
      </div>

      <WhatsAppPairingDialog
        open={pairing !== null}
        initial={pairing}
        connectedNumber={instance?.phone_number ?? null}
        onConnected={reread}
        onClose={() => {
          setPairing(null)
          reread()
        }}
      />

      <WhatsAppDisconnectDialog
        open={disconnecting}
        onOpenChange={setDisconnecting}
        onDone={reread}
      />

      <WhatsAppBotOffDialog
        open={turningBotOff}
        saving={savingBot}
        onOpenChange={setTurningBotOff}
        onConfirm={async () => {
          await answerBot(false)
          setTurningBotOff(false)
        }}
      />

      <WhatsAppOrdersOnDialog
        open={turningOrdersOn}
        saving={savingOrders}
        onOpenChange={setTurningOrdersOn}
        onConfirm={async () => {
          await answerOrders(true)
          setTurningOrdersOn(false)
        }}
      />

      {/* No `onDone` — a test send changes nothing about the instance, so
          refetching the status would be a request that answers itself. */}
      <WhatsAppTestDialog open={testing} onOpenChange={setTesting} />
    </div>
  )
}

/**
 * The label above a group of cards.
 *
 * Plain markup rather than a card, because its whole job is to be the seam
 * between two things that must not read as one thing. A heading inside a card
 * would put the shop's number and the platform's inside the same frame, which
 * is the exact confusion the page is laid out to prevent.
 */
function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="px-1">
      <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function WhatsAppSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="space-y-1.5 px-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
          <Skeleton className="mt-4 h-20 w-full rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5 px-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    </div>
  )
}
