"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@apollo/client/react"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { useChangeLocale } from "@/shared/i18n/client"
import { cn } from "@/shared/lib/utils"
import {
  NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from "../api"
import { useNotificationsStream } from "../use-notifications-stream"
import { hrefFor } from "../lib/href"
import { iconForType, toneForType } from "../lib/notify-type"
import type {
  NotificationsResult,
  NotifyLogEntry,
  MarkReadResult,
  MarkAllReadResult,
} from "../types"

/** Shared by the query and the optimistic cache writes, which must match. */
const FEED_VARIABLES = { page: 1, limit: 15 }

export function NotificationsBell() {
  const t = useTranslations("notifications")
  const { locale } = useChangeLocale()
  const [open, setOpen] = useState(false)
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const { data, client, refetch } = useQuery<NotificationsResult>(
    NOTIFICATIONS,
    {
      variables: FEED_VARIABLES,
      // Keep the badge fresh without a websocket; refetch on open too.
      pollInterval: 60_000,
      fetchPolicy: "cache-and-network",
    },
  )

  const [markRead] = useMutation<MarkReadResult>(MARK_NOTIFICATION_READ)
  const [markAllRead, { loading: markingAll }] =
    useMutation<MarkAllReadResult>(MARK_ALL_NOTIFICATIONS_READ)

  // Real-time push (item C): refetch the feed the instant a notification lands,
  // instead of waiting for the 60s poll. Falls back to polling if SSE is down.
  useNotificationsStream(() => void refetch())

  const unread = data?.notifications.unread_count ?? 0
  const items = data?.notifications.data ?? []
  const dfLocale = locale === "ar" ? ar : enUS

  /** Flip one row to read in the cache and drop the badge by one. */
  function writeRead(id: string | "all") {
    client.cache.updateQuery<NotificationsResult>(
      { query: NOTIFICATIONS, variables: FEED_VARIABLES },
      (prev) =>
        prev && {
          notifications: {
            ...prev.notifications,
            unread_count:
              id === "all"
                ? 0
                : Math.max(0, prev.notifications.unread_count - 1),
            data: prev.notifications.data.map((row) =>
              id === "all" || row.id === id ? { ...row, is_read: true } : row,
            ),
          },
        },
    )
  }

  /**
   * Marking read writes to the cache rather than refetching: a linked item
   * navigates away immediately, and re-running the feed query as the panel
   * unmounts makes the badge flicker before it settles.
   */
  function handleItemClick(n: NotifyLogEntry) {
    if (hrefFor(n, shopSlug)) setOpen(false)
    if (n.is_read) return
    writeRead(n.id)
    void markRead({ variables: { id: n.id } })
  }

  function handleMarkAll() {
    if (unread === 0) return
    writeRead("all")
    void markAllRead()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refetch()
      }}
    >
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-lg"
            className="relative text-white/70"
            aria-label={t("aria", { count: unread })}
          >
            <BellIcon className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        )}
      />
      <PopoverContent align="end" className="w-80 p-0" aria-label={t("title")}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {t("title")}
            {/* Same red as the trigger badge — the count the bell showed is
                still on screen once the panel covers it. */}
            {unread > 0 && (
              <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-red-600 dark:bg-red-500/15 dark:text-red-400">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <CheckCheckIcon className="size-3.5" />
              {t("markAllRead")}
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellIcon className="size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = iconForType(n.notify_type)
                const tone = toneForType(n.notify_type)
                const href = hrefFor(n, shopSlug)
                const rowClass = cn(
                  "relative flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/60",
                  !n.is_read && "bg-muted/30",
                )
                const body = (
                  <>
                    {/* The unread rail carries the row's own hue, so the panel
                        is scannable by colour before a word is read. */}
                    {!n.is_read && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 start-0 w-[3px]",
                          tone.rail,
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
                        n.is_read ? tone.chipRead : tone.chip,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          n.is_read
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {n.notify_text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: dfLocale,
                        })}
                      </span>
                    </span>
                    {!n.is_read && (
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          tone.dot,
                        )}
                      />
                    )}
                  </>
                )
                return (
                  <li key={n.id}>
                    {/* A row that points at something is a real link, so it
                        keeps middle-click, open-in-new-tab, and link
                        semantics for assistive tech. */}
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => handleItemClick(n)}
                        className={rowClass}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className={rowClass}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Shopify's bell is a preview, not the archive: the full paged history
            with per-row actions lives on its own page. */}
        {shopSlug && (
          <div className="border-t border-border">
            <Link
              href={`/store/${shopSlug}/notifications`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted/60"
            >
              {t("viewAll")}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
