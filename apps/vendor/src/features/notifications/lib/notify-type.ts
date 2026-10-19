import {
  BellIcon,
  BanknoteIcon,
  CreditCardIcon,
  MessageSquareIcon,
  PackageIcon,
  RotateCcwIcon,
  StarIcon,
  StoreIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import type { NotifyTypeValue } from "../types"

/**
 * Icon per notification type. Keyed on the back-end `NotifyType` enum, whose
 * GraphQL wire value is the UPPERCASE member name. A value we don't recognize
 * (a legacy row, or a type added server-side before the FE catches up) falls
 * back to the bell.
 */
export function iconForType(type: string): LucideIcon {
  switch (type) {
    case "ORDER":
      return PackageIcon
    case "REFUND":
      return RotateCcwIcon
    case "PAYMENT":
      return BanknoteIcon
    case "INVENTORY":
      return TriangleAlertIcon
    case "REVIEW":
      return StarIcon
    case "STORE_NOTICE":
      return StoreIcon
    case "MESSAGE":
      return MessageSquareIcon
    // The vendor's own subscription, not a customer's payment — a card, not a
    // banknote. PAYMENT keeps the banknote because it is money coming in.
    case "BILLING":
      return CreditCardIcon
    default:
      return BellIcon
  }
}

/**
 * The colour a row is drawn in.
 *
 * `chip` is the icon puck, `chipRead` its already-read state, `text` the
 * label beside it, `rail` the bar down the leading edge of an unread row and
 * `dot` its unread marker.
 */
export type NotifyTone = {
  chip: string
  chipRead: string
  text: string
  rail: string
  dot: string
}

/**
 * Both surfaces used to tint every row with `primary`, and in this theme
 * `--primary` is near-black (`#202223`) — so the accent that was meant to make
 * an unread row stand out rendered as grey on grey, and a refund looked exactly
 * like a new order at a glance. Hue carries that difference instead: green for
 * money in, red for money going back out, amber for something that needs
 * restocking.
 *
 * A read row keeps its hue at a lower saturation rather than dropping to grey,
 * so a row already scanned past is still classifiable. Classes are written out
 * in full because Tailwind scans source text — `bg-${hue}-100` resolves to
 * nothing.
 */
const HUES = {
  emerald: {
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    chipRead:
      "bg-emerald-50 text-emerald-600/70 dark:bg-emerald-500/10 dark:text-emerald-400/60",
    text: "text-emerald-600 dark:text-emerald-400",
    rail: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  rose: {
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
    chipRead:
      "bg-rose-50 text-rose-600/70 dark:bg-rose-500/10 dark:text-rose-400/60",
    text: "text-rose-600 dark:text-rose-400",
    rail: "bg-rose-500",
    dot: "bg-rose-500",
  },
  teal: {
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
    chipRead:
      "bg-teal-50 text-teal-600/70 dark:bg-teal-500/10 dark:text-teal-400/60",
    text: "text-teal-600 dark:text-teal-400",
    rail: "bg-teal-500",
    dot: "bg-teal-500",
  },
  amber: {
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    chipRead:
      "bg-amber-50 text-amber-600/70 dark:bg-amber-500/10 dark:text-amber-400/60",
    text: "text-amber-600 dark:text-amber-400",
    rail: "bg-amber-500",
    dot: "bg-amber-500",
  },
  violet: {
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
    chipRead:
      "bg-violet-50 text-violet-600/70 dark:bg-violet-500/10 dark:text-violet-400/60",
    text: "text-violet-600 dark:text-violet-400",
    rail: "bg-violet-500",
    dot: "bg-violet-500",
  },
  sky: {
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
    chipRead:
      "bg-sky-50 text-sky-600/70 dark:bg-sky-500/10 dark:text-sky-400/60",
    text: "text-sky-600 dark:text-sky-400",
    rail: "bg-sky-500",
    dot: "bg-sky-500",
  },
  indigo: {
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
    chipRead:
      "bg-indigo-50 text-indigo-600/70 dark:bg-indigo-500/10 dark:text-indigo-400/60",
    text: "text-indigo-600 dark:text-indigo-400",
    rail: "bg-indigo-500",
    dot: "bg-indigo-500",
  },
  fuchsia: {
    chip: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400",
    chipRead:
      "bg-fuchsia-50 text-fuchsia-600/70 dark:bg-fuchsia-500/10 dark:text-fuchsia-400/60",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    rail: "bg-fuchsia-500",
    dot: "bg-fuchsia-500",
  },
  slate: {
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    chipRead:
      "bg-slate-100 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400/70",
    text: "text-slate-600 dark:text-slate-400",
    rail: "bg-slate-400",
    dot: "bg-slate-400",
  },
} as const satisfies Record<string, NotifyTone>

/** Same keys as `iconForType`; anything unknown lands on the neutral slate. */
export function toneForType(type: string): NotifyTone {
  switch (type) {
    case "ORDER":
      return HUES.emerald
    case "REFUND":
      return HUES.rose
    case "PAYMENT":
      return HUES.teal
    case "INVENTORY":
      return HUES.amber
    case "REVIEW":
      return HUES.violet
    case "STORE_NOTICE":
      return HUES.sky
    case "MESSAGE":
      return HUES.indigo
    case "BILLING":
      return HUES.fuchsia
    default:
      return HUES.slate
  }
}

/**
 * Every type the preferences screen renders a row for, in display order.
 *
 * `BILLING` is last and is the only row whose email column starts ON — the
 * back-end defaults it that way, because a trial ending or a card that failed
 * is a deadline that reaches nobody if it waits in the bell. The row exists so
 * a vendor can still turn it off; leaving it out would make an on-by-default
 * email the one thing they could not mute.
 */
export const NOTIFY_TYPES: NotifyTypeValue[] = [
  "ORDER",
  "REFUND",
  "PAYMENT",
  "INVENTORY",
  "REVIEW",
  "STORE_NOTICE",
  "MESSAGE",
  "SYSTEM",
  "BILLING",
]
