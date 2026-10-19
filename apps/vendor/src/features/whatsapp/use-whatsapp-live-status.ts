"use client"

import { useCallback } from "react"

import type { WhatsAppStreamEvent } from "./types"
import { useWhatsAppQrStream } from "./use-whatsapp-qr-stream"

/**
 * Keep the settled screen current without a page refresh.
 *
 * The same stream the pairing dialog uses, subscribed to for a different
 * reason. There it is carrying a **credential** — a QR that rotates every
 * twenty seconds and is useless the moment it is stale. Here it is carrying a
 * **fact**: the session dropped, or came back. A merchant who left this tab
 * open should not have to reload to find out their number went offline an hour
 * ago, and that is the whole reason this exists.
 *
 * It costs almost nothing on the server, and that is a property of how the
 * endpoint is built rather than luck. The stream is a Redis subscription
 * merged with a poll loop, and the poll loop is `takeWhile(state !==
 * 'connected')` — so on an already-connected session it stops after its first
 * tick and what remains is a subscription waiting on the inbound webhook's
 * `connection.update`. An idle connected tab is not polling Evolution.
 *
 * Two things it deliberately does not do:
 *
 * - **It does not run when there is no session.** `enabled` is the caller's,
 *   and the caller gates it on `watchable()` — a shop that has never paired
 *   has nothing to report on, and an open socket per idle tab to say so is a
 *   cost with no matching truth.
 * - **It does not carry the QR.** `qr` events are ignored here. A code that
 *   arrived outside the pairing dialog has nowhere to be rendered, and the
 *   rule that a QR only ever lives in component state for as long as it is on
 *   screen is the reason it is never written anywhere else.
 *
 * What it reports is a *change*, not a state: the caller re-reads
 * `myWhatsAppInstance` rather than being handed a status to trust. The stream
 * says "something moved"; the query is what says what it moved to, and keeping
 * those separate means a dropped or duplicated frame costs a refetch rather
 * than a wrong badge.
 */
export function useWhatsAppLiveStatus({
  enabled,
  onChange,
}: {
  enabled: boolean
  /** Fired when the session's state moved. Re-read the status query. */
  onChange: () => void
}): void {
  const onEvent = useCallback(
    (event: WhatsAppStreamEvent) => {
      switch (event.type) {
        case "connected":
        case "state":
          onChange()
          break
        // `qr` has nowhere to go outside the pairing dialog; `error`, `ping`
        // and `expired` are the stream's own health, and the hook's backoff
        // already answers them. None of them changed the session.
        default:
          break
      }
    },
    [onChange],
  )

  useWhatsAppQrStream({ enabled, onEvent })
}
