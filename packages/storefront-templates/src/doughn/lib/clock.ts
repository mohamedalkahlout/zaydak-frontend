import { useSyncExternalStore } from "react"

/**
 * Shop time. Bake times and opening hours are minutes after midnight in the
 * shop's own time zone, wherever the visitor is.
 */

/** minutes after midnight -> "4:05" (wraps round the day) */
export function clockText(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

/** minutes -> "hh:mm:ss", for countdowns */
export function countdownText(minutes: number) {
  const s = Math.max(0, Math.round(minutes * 60))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":")
}

export type BakeStatus = "warm" | "oven" | "fresh" | "later" | "tomorrow"

/** What a bread is doing at minute `m`, and the batch time its chip names. */
export function bakeStatus(times: number[], m: number, hours: { open: number; close: number }): [BakeStatus, number] {
  if (m < hours.open || m >= hours.close) return ["tomorrow", times[0]]
  const past = times.filter((x) => x <= m)
  const next = times.find((x) => x > m)
  if (next !== undefined && next - m <= 12) return ["oven", next]
  if (past.length) {
    const last = past[past.length - 1]
    return [m - last < 45 ? "warm" : "fresh", last]
  }
  return ["later", next ?? times[0]]
}

/* ---------- a once-a-second clock per time zone, shared by every reader */

const formatters = new Map<string, Intl.DateTimeFormat>()
let fakeMinutes: number | null = null

function minutesIn(timeZone: string) {
  if (fakeMinutes !== null) return fakeMinutes
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    formatters.set(timeZone, f)
  }
  const parts = f.formatToParts(new Date())
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value ?? 0)
  return get("hour") * 60 + get("minute") + get("second") / 60
}

interface Ticker {
  value: number
  listeners: Set<() => void>
  timer: ReturnType<typeof setInterval> | null
}
const tickers = new Map<string, Ticker>()

function tickerFor(timeZone: string) {
  let t = tickers.get(timeZone)
  if (!t) {
    t = { value: minutesIn(timeZone), listeners: new Set(), timer: null }
    tickers.set(timeZone, t)
  }
  return t
}

function refresh(timeZone: string, t: Ticker) {
  t.value = minutesIn(timeZone)
  t.listeners.forEach((l) => l())
}

function subscribe(timeZone: string, listener: () => void) {
  const t = tickerFor(timeZone)
  t.listeners.add(listener)
  if (!t.timer) {
    refresh(timeZone, t)
    t.timer = setInterval(() => refresh(timeZone, t), 1000)
  }
  return () => {
    t.listeners.delete(listener)
    if (!t.listeners.size && t.timer) {
      clearInterval(t.timer)
      t.timer = null
    }
  }
}

/** The opening minute stands in on the server, where there is no visitor clock to agree with. */
const SERVER_MINUTES = 240

/** Minutes after midnight in `timeZone`, updated every second. */
export function useZonedMinutes(timeZone: string) {
  return useSyncExternalStore(
    (listener) => subscribe(timeZone, listener),
    () => tickerFor(timeZone).value,
    () => SERVER_MINUTES,
  )
}

/** Pins every clock to one minute (or `null` to follow real time again). For tests and screenshots. */
export function setFakeMinutes(m: number | null) {
  fakeMinutes = m
  tickers.forEach((t, zone) => refresh(zone, t))
}
