import type { WhatsAppInstance } from "../types"

/**
 * The screen's state, which is not the same thing as the row's `status`.
 *
 * The API answers three values — `disconnected` | `connecting` | `connected` —
 * and a screen built directly on those has to answer two questions at every
 * call site that the row cannot: *has this shop ever connected at all*, and
 * *did the last attempt fail*. Both change what the vendor should be shown far
 * more than the connection state does. "Disconnected" with no history is an
 * invitation to set WhatsApp up; the identical value with a `last_error` is a
 * failure that needs an explanation and a retry; and with a `disconnected_at`
 * it is the routine drop that needs neither.
 *
 * Deriving it in one place is what keeps those three from being re-derived,
 * differently, in the card, the badge and the empty state.
 */
export type ConnectionState =
  /** No WhatsApp integration on the platform at all — nothing the vendor can fix. */
  | "unavailable"
  /** No instance yet. The empty state, and the only one that teaches. */
  | "never"
  /** A pairing is open: a code exists and nobody has scanned it yet. */
  | "connecting"
  | "connected"
  /** Was connected, is not now. Routine: a flat phone, a cleared device list. */
  | "disconnected"
  /** The last attempt failed and said why. */
  | "error"

export function connectionState(
  available: boolean,
  instance: WhatsAppInstance | null,
): ConnectionState {
  if (!available) return "unavailable"
  if (!instance) return "never"
  if (instance.status === "connected") return "connected"
  if (instance.status === "connecting") return "connecting"

  // Disconnected, and the two reasons for it read completely differently to a
  // merchant. An error is checked first: a connect that failed *and* left the
  // session down is a fault, not a drop, and the message is the only thing
  // that tells them whether to retry or to call somebody.
  if (instance.last_error) return "error"
  if (instance.disconnected_at) return "disconnected"

  // A row with no history, no error and no drop: the vendor pressed Connect
  // once and closed the dialog without scanning. Nothing has happened yet, so
  // the invitation is still the honest screen.
  return "never"
}

/**
 * The states that describe a session that exists.
 *
 * `unavailable` and `never` are excluded because they are not statuses at all
 * — they are the two ways of having nothing to report, and both are answered
 * by the empty state rather than by the account card. Narrowing the card's
 * prop to this is what stops it carrying two unreachable branches.
 */
export type SessionState = Exclude<ConnectionState, "unavailable" | "never">

/** Whether the number can carry traffic right now. */
export function isLive(state: ConnectionState): boolean {
  return state === "connected"
}

/**
 * Whether a status change is worth watching for over SSE.
 *
 * False for `unavailable` and `never`: there is no session behind them, so an
 * open stream would hold a socket and a Redis subscription per idle tab to
 * report on something that does not exist.
 */
export function watchable(state: ConnectionState): boolean {
  return state !== "unavailable" && state !== "never"
}
