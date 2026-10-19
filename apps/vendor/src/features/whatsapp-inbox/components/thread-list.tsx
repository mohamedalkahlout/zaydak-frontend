"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import {
  Bot,
  BotOff,
  MessageCircle,
  Pause,
  Search,
  TriangleAlert,
  X,
} from "lucide-react"

import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import type { InboxThread } from "../types"

/**
 * Every WhatsApp conversation this shop has, newest activity first.
 *
 * The list answers one question before any other: **who is still waiting.**
 * `unanswered_count` is customer messages since anyone on the shop's side last
 * replied — and the assistant counts as the shop, because from the customer's
 * side it is. A thread the bot already answered is not waiting, even though
 * nobody has read it, and badging it would send merchants to conversations that
 * are already handled.
 */
export function ThreadList({
  threads,
  loading,
  activeId,
  onSelect,
  search = "",
  onSearchChange,
}: {
  threads: InboxThread[]
  loading: boolean
  activeId: string | null
  onSelect: (id: string) => void
  search?: string
  onSearchChange?: (value: string) => void
}) {
  const t = useTranslations("whatsappInbox")
  const format = useFormatter()
  // Anchors the relative stamps so they age on a tick the component actually
  // re-renders for, rather than reading the wall clock mid-render.
  const now = useNow({ updateInterval: 60_000 })

  return (
    <div className="flex h-full flex-col">
      {onSearchChange && (
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search
              className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 ps-8 pe-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("clearSearch")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && threads.length === 0 ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <MessageCircle
              className="size-8 text-muted-foreground/50"
              aria-hidden
            />
            <p className="text-sm font-medium">
              {search ? t("noSearchResults") : t("empty.title")}
            </p>
            {!search && (
              <p className="max-w-xs text-sm text-balance text-muted-foreground">
                {t("empty.body")}
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((thread) => {
              const active = thread.id === activeId
              const waiting = thread.unanswered_count > 0
              const isUnread = !thread.is_read
              const paused =
                thread.ai_paused_until !== null &&
                new Date(thread.ai_paused_until) > new Date()
              /**
               * A standing instruction, and it **outranks both chips below**:
               * a blocked thread is not paused-until-a-clock, and the
               * "answered by the assistant" note would describe something that
               * is no longer going to happen.
               */
              const blocked = thread.is_ai_blocked
              /** A nudge, hidden once the merchant has answered it by blocking. */
              const flagged = thread.flagged_at != null && !blocked

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full px-4 py-3 text-start transition-colors",
                      active ? "bg-accent" : "hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread && (
                          <span
                            title={t("unread")}
                            className="size-2 shrink-0 rounded-full bg-primary"
                          />
                        )}
                        <span
                          dir="ltr"
                          className={cn(
                            "font-mono text-sm tabular-nums truncate",
                            isUnread
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {thread.phone_masked ?? "—"}
                        </span>
                      </div>
                      <time
                        dateTime={thread.updated_at}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {format.relativeTime(new Date(thread.updated_at), now)}
                      </time>
                    </div>

                    <p
                      className={cn(
                        "mt-1 truncate text-sm",
                        isUnread
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {thread.latest_message?.body ?? ""}
                    </p>

                    <div className="mt-1.5 flex items-center gap-2">
                      {waiting && (
                        <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                          {thread.unanswered_count}
                        </span>
                      )}
                      {blocked && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <BotOff className="size-3" aria-hidden />
                          {t("block.badge")}
                        </span>
                      )}
                      {flagged && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                          <TriangleAlert className="size-3" aria-hidden />
                          {t("flag.badge")}
                        </span>
                      )}
                      {!blocked && paused && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                          <Pause className="size-3" aria-hidden />
                          {t("thread.assistantPaused")}
                        </span>
                      )}
                      {!blocked &&
                        !paused &&
                        thread.latest_message?.sender === "AI" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Bot className="size-3" aria-hidden />
                          {t("thread.answeredByAi")}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
