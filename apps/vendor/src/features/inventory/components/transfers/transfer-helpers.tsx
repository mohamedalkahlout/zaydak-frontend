"use client"

import { useTranslations } from "next-intl"
import { ImageIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export type TransferStatus =
  | "DRAFT"
  | "READY_TO_SHIP"
  | "SENT"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED"

/** Pull a usable thumbnail URL out of the product/variant `image` JSON. */
export function imageThumb(image: unknown): string | null {
  if (!image) return null
  if (typeof image === "string") return image
  const img = image as Record<string, string | undefined>
  return img.thumbnail ?? img.original ?? img.url ?? null
}

/** Localize a translatable JSON name, preferring the active locale. */
export function displayName(
  name: Record<string, string> | string | null | undefined,
  locale = "en",
): string {
  if (!name) return "—"
  if (typeof name === "string") return name
  return name[locale] ?? name.en ?? name.ar ?? Object.values(name)[0] ?? "—"
}

/**
 * Shopify-style transfer id — the per-shop sequential number padded to four
 * digits (`#T0001`). Falls back to a short slice of the cuid for the
 * pre-backfill window where `number` may still be null.
 */
export function formatTransferNumber(
  number: number | null | undefined,
  id: string,
): string {
  if (number != null) return `#T${String(number).padStart(4, "0")}`
  return `#${id.slice(0, 6).toUpperCase()}`
}

/**
 * Shopify shows each transfer's single shipment as `#T0001-1`. We don't split a
 * transfer into multiple shipments yet, so it's always `-1`.
 */
export function shipmentLabel(
  number: number | null | undefined,
  id: string,
): string {
  return `${formatTransferNumber(number, id)}-1`
}

/** Format minor-unit money for display (no currency symbol — shop-agnostic). */
export function formatAmount(cents: number, locale = "en"): string {
  return (cents / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ── Calendar-date helpers ────────────────────────────────────────────────────
// `expected_arrival` is a *calendar date* stored as a DateTime (UTC). To avoid
// timezone drift (and a perma-stuck save bar when the staged value doesn't match
// the server's ISO), we always round-trip it as the UTC midnight of its calendar
// day. These helpers keep staging, the snapshot, and display consistent.

/** Normalize any instant to the ISO of its UTC calendar day (midnight UTC). */
export function toUtcDayIso(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString()
}

/** A calendar selection is a LOCAL-midnight Date — stage its day as UTC midnight. */
export function localDayToUtcIso(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  ).toISOString()
}

/** Parse a stored UTC-day ISO into a LOCAL Date on the same calendar day. */
export function utcIsoToLocalDay(
  iso: string | null | undefined,
): Date | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Format a stored UTC-day ISO as a date string without timezone drift. */
export function formatUtcDay(iso: string, locale = "en"): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

// Map our six lifecycle states onto Shopify's four badge buckets: SENT/PARTIAL
// collapse to "In progress", RECEIVED reads "Transferred".
const STATUS_TO_BADGE: Record<
  TransferStatus,
  "DRAFT" | "READY_TO_SHIP" | "IN_PROGRESS" | "TRANSFERRED" | "CANCELLED"
> = {
  DRAFT: "DRAFT",
  READY_TO_SHIP: "READY_TO_SHIP",
  SENT: "IN_PROGRESS",
  PARTIAL: "IN_PROGRESS",
  RECEIVED: "TRANSFERRED",
  CANCELLED: "CANCELLED",
}

const BADGE_TONE: Record<string, { pill: string; dot: string }> = {
  DRAFT: { pill: "bg-muted text-foreground/70", dot: "bg-muted-foreground/50" },
  READY_TO_SHIP: {
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  IN_PROGRESS: {
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
    dot: "ring-2 ring-sky-500 ring-inset bg-transparent",
  },
  TRANSFERRED: {
    pill: "bg-muted text-foreground/80",
    dot: "bg-foreground/70",
  },
  CANCELLED: {
    pill: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    dot: "bg-red-500",
  },
}

/**
 * Shopify-parity status pill — a colored dot + label. `IN_PROGRESS` uses a
 * hollow ring dot (matching Shopify's "in progress" affordance), the rest a
 * filled dot.
 */
export function StatusBadge({
  status,
  size = "sm",
}: {
  status: TransferStatus
  size?: "sm" | "md"
}) {
  const t = useTranslations("transfers.badge")
  const key = STATUS_TO_BADGE[status]
  const tone = BADGE_TONE[key]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-xs",
        tone.pill,
      )}
    >
      <span className={cn("size-2 rounded-full", tone.dot)} />
      {t(key)}
    </span>
  )
}

/**
 * Product cell shared by the list, detail and form — thumbnail + localized
 * name + variant + SKU.
 */
export function LineItemCell({
  line,
  locale,
  compact = false,
}: {
  line: {
    product_id?: string | null
    variation_option_id?: string | null
    product_name?: Record<string, string> | string | null
    variant_title?: Record<string, string> | string | null
    image?: unknown
    sku?: string | null
  }
  locale: string
  compact?: boolean
}) {
  const thumb = imageThumb(line.image)
  const name = line.product_name
    ? displayName(line.product_name, locale)
    : (line.variation_option_id ?? line.product_id ?? "—")
  const variant = line.variant_title
    ? displayName(line.variant_title, locale)
    : null
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/60",
          compact ? "size-9" : "size-10",
        )}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {variant && <span className="truncate">{variant}</span>}
          {variant && line.sku && <span>·</span>}
          {line.sku && <span className="truncate">{line.sku}</span>}
        </div>
      </div>
    </div>
  )
}

/**
 * Relative timestamp for the timeline ("28 minutes ago", "Yesterday", a
 * date). `t` is scoped to `transfers.relTime`.
 */
export function relativeTime(
  iso: string,
  t: (key: string, values?: Record<string, number>) => string,
  locale: string,
): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return t("justNow")
  if (min < 60) return t("minutesAgo", { count: min })
  if (hr < 24) return t("hoursAgo", { count: hr })
  if (day === 1) return t("yesterday")
  if (day < 7) return t("daysAgo", { count: day })
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Day-group header for the timeline ("Today" / "Yesterday" / a date). */
export function dayBucket(
  iso: string,
  t: (key: string) => string,
  locale: string,
): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (days <= 0) return t("today")
  if (days === 1) return t("yesterday")
  return d.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}
