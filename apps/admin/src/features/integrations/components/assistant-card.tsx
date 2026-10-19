"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  CONNECT_PLATFORM_WHATSAPP,
  DISCONNECT_PLATFORM_WHATSAPP,
  GET_PLATFORM_WHATSAPP,
  SYNC_PLATFORM_WHATSAPP_WEBHOOK,
} from "../api-assistant"
import {
  useAssistantQrStream,
  type AssistantStreamEvent,
} from "../use-assistant-qr-stream"

/**
 * The vendor assistant's number, paired here by scanning a QR.
 *
 * **This is the one thing on the Integrations screen that is not a form**, and
 * it sits below the credentials rather than inside them because it depends on
 * them: the Evolution server has to be configured before there is anywhere to
 * pair against. An admin scans once, and every vendor on the platform then has
 * a number that can answer them — each one is enrolled automatically when they
 * connect their own store's WhatsApp, so nothing further is asked of anybody.
 *
 * Two rules run through it, both inherited from the vendor's own connect screen
 * because they are properties of WhatsApp rather than of either audience.
 *
 * **The QR is never stored.** It is a live credential — whoever scans it links
 * their own device to the platform's assistant account, and with it every
 * conversation that account can see. It arrives on a stream, is rendered, and is
 * gone: no cache, no column, no log.
 *
 * **Disconnection is routine, not an error.** The phone goes flat, someone
 * unlinks devices, WhatsApp drops an idle session after about a fortnight. So
 * "Disconnected" is a normal state with a way out of it rather than a red
 * failure — but it is reported with the number of vendors it silences, because
 * here that is not one merchant's inconvenience, it is everyone's.
 */
export function AssistantCard() {
  const t = useTranslations("integrations.assistant")

  /**
   * The code currently on screen, and nothing else.
   *
   * Component state deliberately: not the Apollo cache, not a store, not the
   * URL. Every frame of it is a credential, and the only thing that should
   * outlive this component is the session it produced.
   */
  const [qr, setQr] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [streamError, setStreamError] = useState(false)

  // No generic argument: the codegen `gql` tag makes this a TypedDocumentNode,
  // so the result shape comes from the schema. A hand-written interface here
  // would keep compiling after the schema moved underneath it.
  const { data, loading, refetch } = useQuery(GET_PLATFORM_WHATSAPP, {
    // The row is reconciled against Evolution on every read, so a session that
    // dropped while this tab sat open is corrected by asking again — never
    // served from a cache that cannot know the phone died.
    fetchPolicy: "cache-and-network",
  })

  const onEvent = useCallback(
    (event: AssistantStreamEvent) => {
      switch (event.type) {
        case "qr":
          setStreamError(false)
          setQr(event.qr)
          break
        case "connected":
          // Pairing is over the moment the session opens. Closing the panel
          // here rather than waiting for the admin means the QR stops being
          // rendered the instant it stops being needed.
          setPairing(false)
          setQr(null)
          sileo.success({ title: t("toast.connected") })
          void refetch()
          break
        case "error":
          setStreamError(true)
          break
        default:
          break
      }
    },
    [refetch, t],
  )

  useAssistantQrStream({ enabled: pairing, onEvent })

  const [connect, { loading: connecting }] = useMutation(
    CONNECT_PLATFORM_WHATSAPP,
  )
  const [disconnect, { loading: disconnecting }] = useMutation(
    DISCONNECT_PLATFORM_WHATSAPP,
  )
  const [syncWebhook, { loading: syncing }] = useMutation(
    SYNC_PLATFORM_WHATSAPP_WEBHOOK,
  )

  const onConnect = async () => {
    try {
      const { data: result } = await connect()
      const handshake = result?.connectPlatformWhatsApp.data
      if (!handshake) return
      // The first code comes back on this response; every one after it arrives
      // on the stream the panel opens.
      setQr(handshake.qr_code ?? null)
      setPairing(true)
    } catch (err) {
      sileo.error({
        title: t("toast.connectFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const onDisconnect = async () => {
    try {
      await disconnect()
      sileo.success({ title: t("toast.disconnected") })
      void refetch()
    } catch (err) {
      sileo.error({
        title: t("toast.disconnectFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const onSyncWebhook = async () => {
    try {
      const { data: result } = await syncWebhook()
      // `success: false` rather than a throw is the honest shape here — the
      // mutation reached the server and the server could not reach Evolution.
      if (result?.syncPlatformWhatsAppWebhook.success) {
        sileo.success({ title: t("toast.webhookSynced") })
      } else {
        sileo.error({ title: t("toast.webhookFailed") })
      }
    } catch (err) {
      sileo.error({
        title: t("toast.webhookFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const row = data?.platformWhatsApp?.data ?? null
  const connected = row?.status === "connected"
  const busy = connecting || disconnecting || syncing

  return (
    <section className="mt-4 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="p-4">
        <div className="mb-3 flex items-start gap-2">
          <BotIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-heading text-base leading-snug font-medium">
              {t("title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>

        {loading && !data ? (
          <Skeleton className="h-20 w-full" />
        ) : pairing ? (
          <PairingPanel
            qr={qr}
            error={streamError}
            onCancel={() => {
              setPairing(false)
              setQr(null)
              void refetch()
            }}
          />
        ) : connected ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("state.connected", { phone: row?.phone_masked ?? "" })}
              </p>
              {/* How many vendors this number is currently serving. Stated
                  because losing it is not one merchant's problem here — it
                  silences every linked handset at once. */}
              <p className="text-xs text-muted-foreground">
                {t("state.linkedVendors", { count: row?.linked_vendors ?? 0 })}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm">{t("state.notConnected")}</p>
                {/* Evolution's own words, already masked server-side. Shown
                    rather than swallowed: "could not connect" with no reason
                    is the message that generates a support ticket. */}
                {row?.last_error ? (
                  <p className="text-xs text-muted-foreground">
                    {row.last_error}
                  </p>
                ) : null}
                {row && row.linked_vendors > 0 ? (
                  <p className="text-xs text-amber-600">
                    {t("state.strandedVendors", {
                      count: row.linked_vendors,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {!pairing ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-foreground/10 bg-muted/30 px-4 py-3">
          {connected ? (
            <>
              {/* The singular of the per-shop "Sync webhooks", and it exists
                  for the same reason: the callback is registered at pairing, so
                  changing the origin afterwards reaches an already-paired
                  session not at all. */}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void onSyncWebhook()}
              >
                {syncing ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                {t("action.syncWebhook")}
              </Button>
              <Button
                variant="ghost"
                className="ms-auto text-destructive"
                disabled={busy}
                onClick={() => void onDisconnect()}
              >
                <UnplugIcon className="size-4" />
                {t("action.disconnect")}
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={() => void onConnect()}>
              {connecting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <BotIcon className="size-4" />
              )}
              {t("action.connect")}
            </Button>
          )}
        </footer>
      ) : null}
    </section>
  )
}

/**
 * The scan panel.
 *
 * Renders whatever code the stream last pushed. A blank frame between rotations
 * is normal — Baileys mints the next one a moment after retiring the last — so
 * the empty state is a spinner rather than an error.
 */
function PairingPanel({
  qr,
  error,
  onCancel,
}: {
  qr: string | null
  error: boolean
  onCancel: () => void
}) {
  const t = useTranslations("integrations.assistant")

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("pairing.body")}</p>

      <div className="flex justify-center">
        <div className="flex size-64 items-center justify-center rounded-lg bg-white p-3 ring-1 ring-foreground/10">
          {qr ? (
            // `unoptimized` because this is a data URL that changes every
            // ~30s — running each frame through the image optimizer would
            // cache a credential on disk and add latency to a code that
            // expires before the round trip is worth it.
            <Image
              src={qr}
              alt={t("pairing.qrAlt")}
              width={232}
              height={232}
              unoptimized
              className="size-full object-contain"
            />
          ) : (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {error ? (
        <p className="text-center text-xs text-destructive">
          {t("pairing.streamError")}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t("pairing.refreshNote")}
        </p>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={onCancel}>
          {t("pairing.cancel")}
        </Button>
      </div>
    </div>
  )
}
