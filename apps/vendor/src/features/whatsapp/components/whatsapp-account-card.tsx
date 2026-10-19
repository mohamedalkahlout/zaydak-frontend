"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
  AlertTriangle,
  Loader2,
  MessageCircle,
  RefreshCw,
  SendHorizontal,
  Unplug,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import type { SessionState } from "../lib/connection"
import type { WhatsAppInstance } from "../types"
import { WhatsAppStatusPill, type PillTone } from "./whatsapp-status-pill"

/** Which of the four looks each state wears. See `whatsapp-status-pill`. */
const TONE: Record<SessionState, PillTone> = {
  connecting: "pending",
  connected: "live",
  disconnected: "off",
  error: "fault",
}

/**
 * The shop's own number: one card, four live states.
 *
 * This is the card a merchant looks at to answer one question — *can my
 * customers reach me right now* — so the answer is the largest thing in it and
 * everything else is subordinate to it. The number, the timestamp and the
 * actions are all support for a status the vendor should be able to read from
 * across a room.
 *
 * The states are not four cards, deliberately. A merchant returning to this
 * screen after a dropped session needs the *same* object in front of them, in
 * the same place, having changed — not a different screen that looks like a
 * different feature. Only the pill, the body line and the button row move.
 *
 * **Disconnected is not an error, and it is not painted as one.** Phones go
 * flat, device lists get cleared, WhatsApp drops a session that has been idle
 * for about a fortnight. It is a routine state with a one-press way out, and
 * spending the destructive colour on it would leave nothing left for the state
 * that has actually failed.
 */
export function WhatsAppAccountCard({
  state,
  instance,
  connecting,
  refreshing,
  onConnect,
  onRefresh,
  onDisconnect,
  onTest,
}: {
  state: SessionState
  instance: WhatsAppInstance | null
  /** A connect mutation is in flight — the button, not the session. */
  connecting: boolean
  refreshing: boolean
  onConnect: () => void
  onRefresh: () => void
  onDisconnect: () => void
  onTest: () => void
}) {
  const t = useTranslations("settings.whatsapp")
  const format = useFormatter()
  const live = state === "connected"

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 transition-colors",
        live ? "ring-emerald-500/25" : "ring-foreground/10",
      )}
    >
      {/* The header carries the identity and the verdict, side by side. On a
          phone the pill wraps under the title rather than shrinking — a status
          is the one thing on this card that must never be truncated. */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors",
              live
                ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                : "bg-muted text-muted-foreground ring-foreground/10",
            )}
          >
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-base leading-snug font-medium">
              {t("card.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("card.subtitle")}
            </p>
          </div>
        </div>
        <WhatsAppStatusPill
          tone={TONE[state]}
          label={t(`state.${state}.label`)}
        />
      </div>

      <div className="space-y-4 px-4 pb-4">
        {/* The connected number, given the weight of a headline. It is the one
            fact on the card a vendor came to check, and it is masked at the
            API boundary — they know their own number; what this answers is
            *which* phone picked up the scan. */}
        {live && (
          <p
            dir="ltr"
            className="font-mono text-2xl leading-none font-medium tabular-nums"
          >
            {instance?.phone_number ?? "—"}
          </p>
        )}

        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(`state.${state}.body`)}
        </p>

        {live && instance?.last_connected_at && (
          <p className="text-xs text-muted-foreground">
            {t("field.since", {
              when: format.dateTime(new Date(instance.last_connected_at), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}

        {/* The provider's own words, shown rather than swallowed. It is masked
            server-side before it ever reaches here, and a merchant who can
            read "device limit reached" fixes it themselves in a minute —
            a generic "something went wrong" sends them to support instead. */}
        {state === "error" && instance?.last_error && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-sm text-destructive ring-1 ring-destructive/15 ring-inset">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{instance.last_error}</span>
          </p>
        )}

        {/* The consent block, above the button and not in a footnote — what a
            scan grants is bigger than this screen's subject: access to every
            conversation on the account, not only the ones about the shop. It
            is shown on every path that leads to a scan, including the retry
            after a failure, because a second scan grants exactly as much as
            the first. */}
        {(state === "disconnected" || state === "error") && (
          <div className="rounded-lg bg-amber-500/5 p-3 ring-1 ring-amber-500/20 ring-inset">
            <p className="flex items-start gap-2 text-sm font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {t("consent.title")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("consent.body")}
            </p>
          </div>
        )}

        <Actions
          state={state}
          connecting={connecting}
          refreshing={refreshing}
          onConnect={onConnect}
          onRefresh={onRefresh}
          onDisconnect={onDisconnect}
          onTest={onTest}
        />
      </div>
    </section>
  )
}

/**
 * One button row per state, and the ordering rule is the same in all of them:
 * the thing a merchant is on this card to do comes first.
 *
 * Disconnect is never the primary and never destructive-coloured. It does not
 * delete anything — the configuration and the bot setting both survive it —
 * and dressing it as a deletion is how a vendor ends up afraid of the button
 * that fixes a stuck session.
 */
function Actions({
  state,
  connecting,
  refreshing,
  onConnect,
  onRefresh,
  onDisconnect,
  onTest,
}: {
  state: SessionState
  connecting: boolean
  refreshing: boolean
  onConnect: () => void
  onRefresh: () => void
  onDisconnect: () => void
  onTest: () => void
}) {
  const t = useTranslations("settings.whatsapp.action")

  if (state === "connected") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onTest}>
          <SendHorizontal className="size-4" />
          {t("test")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          <Unplug className="size-4" />
          {t("disconnect")}
        </Button>
      </div>
    )
  }

  if (state === "connecting") {
    return (
      <div className="flex flex-wrap gap-2">
        {/* Re-opening the pairing dialog rather than starting a new session:
            the label says "resume" because a vendor who closed the modal by
            accident is looking for their code, not for a fresh attempt. */}
        <Button size="sm" onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {t("resume")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          {t("cancelPairing")}
        </Button>
      </div>
    )
  }

  // disconnected | error — the same single button either way. "Reconnect"
  // rather than "Connect", because the row already exists: what the vendor is
  // doing is getting something back, not setting something up.
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onConnect} disabled={connecting}>
        {connecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageCircle className="size-4" />
        )}
        {t("reconnect")}
      </Button>
    </div>
  )
}
