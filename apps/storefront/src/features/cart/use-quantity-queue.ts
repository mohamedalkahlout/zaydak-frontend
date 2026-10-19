"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * How long a line has to sit still before its new quantity is written.
 *
 * Long enough that a shopper walking 1 -> 5 on the `+` button sends one
 * request, short enough that a single deliberate tap does not feel parked.
 */
export const QUANTITY_QUIET_MS = 450

interface LineWork {
  /** The pending `setTimeout`, or null when nothing is waiting. */
  timer: number | null
  /** The quantity the shopper wants and the server has not confirmed. */
  target: number | null
  /** True while this line's write is in the air. */
  sending: boolean
}

export interface QuantityQueue {
  /** What the stepper should show — the shopper's number until it is banked. */
  quantityOf: (itemId: string, serverQuantity: number) => number
  /** Record a new quantity. The write follows once the tapping stops. */
  set: (itemId: string, quantity: number) => void
  /** True while this line's number is ahead of the server's. */
  isPending: (itemId: string) => boolean
  /** True while any line is — which is exactly how long the money is stale. */
  busy: boolean
  /** Drop a queued write. Used when the line is about to be removed anyway. */
  cancel: (itemId: string) => void
}

/**
 * One request per *decision*, not per tap.
 *
 * `updateCartItem` reprices the whole cart — coupons, flash sales, tax — so a
 * shopper walking a line from 1 to 5 on the `+` button used to fire five of
 * them, each one repricing the cart to a number they were already past. Worse,
 * every stepper was disabled for the round trip (`useCart().mutating` is true
 * for any cart mutation, on every line at once), so the fourth tap landed on a
 * dead button and the count stopped moving under the shopper's finger.
 *
 * So the taps and the write are separated. Each tap updates a local number
 * immediately — the stepper never waits for anything — and the write goes out
 * `delay` after the last one, carrying the final quantity. Quantity is sent as
 * an absolute value rather than a delta, which is what makes collapsing them
 * safe: five taps and one write ending at 5 are the same instruction.
 *
 * Three things this has to get right beyond the timer:
 *
 * **Writes for one line never overlap.** A second write is not started while
 * the first is in the air; it is held and sent when that one settles. Both
 * mutations return the whole cart envelope and Apollo writes it into the cache
 * on arrival, so two in flight means the slower one can land last and paint a
 * cart that is one tap out of date.
 *
 * **The pending number survives its own write.** If the shopper taps again
 * while a write is in the air, the response that comes back describes a cart
 * they have already moved past — so the local number is only cleared when what
 * came back is what was last asked for. Everything else falls back to the
 * server's number, including every failure: a rejected write leaves the line
 * showing what the shop actually has, not what was typed at it.
 *
 * **Leaving flushes.** The drawer's lines unmount the moment the panel closes,
 * and the cart page's when the shopper navigates. A tap followed straight away
 * by a close would otherwise be dropped by the cleanup that clears the timer —
 * accepted on screen, never sent. The pending write is fired on the way out.
 */
export function useQuantityQueue(
  commit: (itemId: string, quantity: number) => Promise<unknown>,
  {
    delay = QUANTITY_QUIET_MS,
    onError,
  }: { delay?: number; onError?: (error: unknown) => void } = {},
): QuantityQueue {
  const [pending, setPending] = useState<Record<string, number>>({})

  // Latest-callback refs, written in an effect rather than during render:
  // `commit` is a new closure on every render of the list (it captures the
  // Apollo mutate function), and a timer that fired against a stale one would
  // still work — but the rule that keeps refs out of the render body is worth
  // more than the exception.
  const commitRef = useRef(commit)
  const errorRef = useRef(onError)
  useEffect(() => {
    commitRef.current = commit
    errorRef.current = onError
  }, [commit, onError])

  const linesRef = useRef(new Map<string, LineWork>())

  /** Hands the line back to the server's number. */
  const settle = useCallback((itemId: string) => {
    setPending((current) => {
      if (!(itemId in current)) return current
      const next = { ...current }
      delete next[itemId]
      return next
    })
  }, [])

  const drain = useCallback(
    function drain(itemId: string): void {
      const line = linesRef.current.get(itemId)
      if (!line || line.sending || line.target === null) return

      const target = line.target
      line.sending = true

      void Promise.resolve(commitRef.current(itemId, target))
        .then(() => {
          // Only a line that stopped moving is settled; anything tapped while
          // this was in the air is still ahead of what just came back.
          if (line.target === target) {
            line.target = null
            settle(itemId)
          }
        })
        .catch((error: unknown) => {
          line.target = null
          settle(itemId)
          errorRef.current?.(error)
        })
        .finally(() => {
          line.sending = false
          if (line.target === null) linesRef.current.delete(itemId)
          else drain(itemId)
        })
    },
    [settle],
  )

  const set = useCallback(
    (itemId: string, quantity: number) => {
      const lines = linesRef.current
      const line = lines.get(itemId) ?? {
        timer: null,
        target: null,
        sending: false,
      }
      lines.set(itemId, line)

      line.target = quantity
      setPending((current) => ({ ...current, [itemId]: quantity }))

      if (line.timer !== null) window.clearTimeout(line.timer)
      line.timer = window.setTimeout(() => {
        line.timer = null
        drain(itemId)
      }, delay)
    },
    [delay, drain],
  )

  const cancel = useCallback(
    (itemId: string) => {
      const line = linesRef.current.get(itemId)
      if (line) {
        if (line.timer !== null) window.clearTimeout(line.timer)
        line.timer = null
        line.target = null
        // A write already in the air cannot be recalled; clearing the target is
        // what stops the queue from starting another one behind it.
        if (!line.sending) linesRef.current.delete(itemId)
      }
      settle(itemId)
    },
    [settle],
  )

  useEffect(() => {
    const lines = linesRef.current
    return () => {
      for (const [itemId, line] of lines) {
        if (line.timer !== null) window.clearTimeout(line.timer)
        line.timer = null
        // Fire and forget: the component asking is already gone, but the
        // mutation belongs to the Apollo client, which is not.
        if (line.target !== null && !line.sending) {
          void Promise.resolve(commitRef.current(itemId, line.target)).catch(
            () => {},
          )
        }
      }
      lines.clear()
    }
  }, [])

  const quantityOf = useCallback(
    (itemId: string, serverQuantity: number) => pending[itemId] ?? serverQuantity,
    [pending],
  )

  const isPending = useCallback((itemId: string) => itemId in pending, [pending])

  return {
    quantityOf,
    isPending,
    busy: Object.keys(pending).length > 0,
    set,
    cancel,
  }
}
