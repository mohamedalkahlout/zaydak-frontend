/** Never wait longer than this between stream reconnect attempts. */
export const MAX_RECONNECT_DELAY_MS = 30_000

/**
 * Delay before reconnect attempt number `attempt` (0-based): exponential from
 * one second, capped, plus up to 250ms of jitter.
 *
 * The stream ticket is single-use, so `EventSource`'s native retry would replay
 * a dead ticket against the server forever. We close on error and re-handshake
 * ourselves, which means the backoff is ours to get right: without it, a
 * back-end that is down or a session that has been revoked turns every open tab
 * into a tight request loop.
 *
 * Jitter is passed in rather than read from `Math.random()` so the schedule is
 * testable.
 */
export function reconnectDelayMs(attempt: number, jitter = Math.random()): number {
  const exponential = 1000 * 2 ** Math.max(0, attempt)
  return Math.min(MAX_RECONNECT_DELAY_MS, exponential) + Math.round(jitter * 250)
}
