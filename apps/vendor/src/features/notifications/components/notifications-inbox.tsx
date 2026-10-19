"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@apollo/client/react"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import {
  BellIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronRightIcon,
  DotIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { useChangeLocale } from "@/shared/i18n/client"
import { cn } from "@/shared/lib/utils"
import {
  NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_NOTIFICATION_UNREAD,
  DELETE_NOTIFICATION,
  MARK_ALL_NOTIFICATIONS_READ,
} from "../api"
import { useNotificationsStream } from "../use-notifications-stream"
import { hrefFor } from "../lib/href"
import { iconForType, toneForType } from "../lib/notify-type"
import type {
  NotificationsResult,
  NotifyLogEntry,
  MarkReadResult,
  MarkUnreadResult,
  MarkAllReadResult,
  DeleteNotificationResult,
} from "../types"

/** Bigger than the bell's 15 — this is the full-page view. */
const PAGE_SIZE = 20

type Filter = "all" | "unread"

/**
 * The full notification history: the rows the bell only previews, plus the
 * per-row actions it has no room for (mark unread, delete) and paging.
 *
 * Every mutation refetches rather than patching the cache. The bell renders the
 * same `Notifications` query under different variables, so a targeted cache
 * write here would leave its badge stale; `refetch` on the shared query name
 * updates both surfaces at once.
 */
export function NotificationsInbox() {
  const t = useTranslations("notifications")
  const { locale } = useChangeLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const [filter, setFilter] = useState<Filter>("all")
  const [page, setPage] = useState(1)

  const { data, loading, client, refetch } = useQuery<NotificationsResult>(
    NOTIFICATIONS,
    {
      variables: {
        page,
        limit: PAGE_SIZE,
        unread_only: filter === "unread",
      },
      fetchPolicy: "cache-and-network",
    },
  )

  const [markRead] = useMutation<MarkReadResult>(MARK_NOTIFICATION_READ)
  const [markUnread] = useMutation<MarkUnreadResult>(MARK_NOTIFICATION_UNREAD)
  const [remove] = useMutation<DeleteNotificationResult>(DELETE_NOTIFICATION)
  const [markAllRead, { loading: markingAll }] =
    useMutation<MarkAllReadResult>(MARK_ALL_NOTIFICATIONS_READ)

  useNotificationsStream(() => void refetch())

  const items = data?.notifications.data ?? []
  const meta = data?.notifications.meta
  const unread = data?.notifications.unread_count ?? 0
  const totalPages = meta?.total_pages ?? 1
  const dfLocale = locale === "ar" ? ar : enUS

  /** Refetch every live `Notifications` query — this page's and the bell's. */
  function syncAll() {
    void client.refetchQueries({ include: ["Notifications"] })
  }

  function switchFilter(next: Filter) {
    if (next === filter) return
    setFilter(next)
    setPage(1)
  }

  async function toggleRead(n: NotifyLogEntry) {
    if (n.is_read) await markUnread({ variables: { id: n.id } })
    else await markRead({ variables: { id: n.id } })
    syncAll()
  }

  async function handleDelete(n: NotifyLogEntry) {
    await remove({ variables: { id: n.id } })
    // Deleting the last row of the last page would strand the user on an empty
    // page, so step back before the refetch lands.
    if (items.length === 1 && page > 1) setPage((p) => p - 1)
    syncAll()
  }

  async function handleMarkAll() {
    if (unread === 0) return
    await markAllRead()
    syncAll()
  }

  /** Marking read on click mirrors the bell: opening a row consumes it. */
  function handleOpen(n: NotifyLogEntry) {
    if (n.is_read) return
    void markRead({ variables: { id: n.id } }).then(syncAll)
  }

  const showSkeleton = loading && items.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center rounded-lg bg-muted p-[3px]"
          role="group"
        >
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                filter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${value}`)}
              {value === "unread" && unread > 0 && (
                <span className="ms-1.5 text-xs text-muted-foreground">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={markingAll}
          >
            <CheckCheckIcon className="size-3.5" />
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {showSkeleton ? (
          <div className="p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="my-2 h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <BellIcon className="size-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? t("emptyUnread") : t("empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = iconForType(n.notify_type)
              const tone = toneForType(n.notify_type)
              const href = hrefFor(n, shopSlug)
              return (
                <li
                  key={n.id}
                  className={cn(
                    "group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40",
                    !n.is_read && "bg-muted/25",
                  )}
                >
                  {/* Same rail as the bell: unread reads as a colour, not as a
                      slightly darker grey. */}
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
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
                      n.is_read ? tone.chipRead : tone.chip,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  {/* The text is the link, not the whole row: the row also
                      carries buttons, and a button inside an anchor is invalid. */}
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => handleOpen(n)}
                        className={cn(
                          "block text-sm leading-snug hover:underline",
                          n.is_read
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {n.notify_text}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "block text-sm leading-snug",
                          n.is_read
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {n.notify_text}
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: dfLocale,
                      })}
                      {!n.is_read && (
                        <>
                          <DotIcon className="size-3" aria-hidden />
                          <span className={cn("font-medium", tone.text)}>
                            {t("filter.unread")}
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void toggleRead(n)}
                      title={n.is_read ? t("markUnread") : t("markRead")}
                      aria-label={n.is_read ? t("markUnread") : t("markRead")}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {n.is_read ? (
                        <DotIcon className="size-4" />
                      ) : (
                        <CheckIcon className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(n)}
                      title={t("delete")}
                      aria-label={t("delete")}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRightIcon className="size-4 rotate-180 rtl:rotate-0" />
            {t("prev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
            <ChevronRightIcon className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  )
}
