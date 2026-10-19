"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { Command as CommandPrimitive } from "cmdk"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { MessageSquareIcon, SearchIcon, SquarePenIcon, XIcon } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import { VENDOR_AGENT_CONVERSATIONS } from "@/features/ai/api/queries"
import { highlight } from "@/features/ai/lib/highlight"
import type {
  VendorAgentConversationsResponse,
  VendorAgentConversationSummary,
} from "@/features/ai/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeId: string | null
  /** Text direction and the relative-time locale. */
  locale: "ar" | "en"
  /** Load an existing conversation into the panel. */
  onSelect: (id: string) => void
  /** Start a fresh conversation. */
  onNewChat: () => void
}

/**
 * Shopify-style command-palette for the docked chat panel. Opening it from
 * the panel header lets the vendor search their past conversations and jump
 * into one — or start a new chat — without leaving the panel. Filtering is
 * server-side (title + message body), mirroring the full-page sidebar; cmdk's
 * own filter is turned off (`shouldFilter={false}`) so it just renders what
 * the query returns and keeps the arrow-key highlight.
 */
export function ConversationSearchDialog({
  open,
  onOpenChange,
  activeId,
  locale,
  onSelect,
  onNewChat,
}: Props) {
  const t = useTranslations("aiChat")
  const isAr = locale === "ar"
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce so fast typing doesn't spam the backend (matches the sidebar).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // Reset the search each time the dialog opens so it never reopens onto a
  // stale filter. Adjusted during render rather than from an effect: React
  // re-runs this component immediately with the box cleared, where an effect
  // would first paint the previous search — and fire a query for it.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setDebouncedQuery("")
    }
  }

  const { data, loading } = useQuery<VendorAgentConversationsResponse>(
    VENDOR_AGENT_CONVERSATIONS,
    {
      variables: { search: debouncedQuery.trim() || null },
      fetchPolicy: "cache-and-network",
      skip: !open,
    },
  )

  const conversations = data?.vendorAgentConversations ?? []
  const hasSearch = debouncedQuery.trim().length > 0
  // Only show the skeleton on the very first load (no rows to show yet) —
  // background refetches keep the current list visible so it never flickers.
  const showSkeleton = loading && conversations.length === 0
  const showEmpty = !loading && conversations.length === 0

  // Bucket by recency (Today / Yesterday / Previous 7 days / Older). While a
  // search is active we collapse to a single "Results" group — grouping by
  // date is noise when the vendor is hunting for a specific thread.
  const groups = useMemo(
    () =>
      groupByRecency(conversations, hasSearch, (key) =>
        t(`search.groups.${key}`),
      ),
    [conversations, hasSearch, t],
  )

  const handleNew = () => {
    onOpenChange(false)
    onNewChat()
  }
  const handleSelect = (id: string) => {
    onOpenChange(false)
    onSelect(id)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("search.title")}
      description={t("search.description")}
      className="top-[8vh]! flex max-h-[84vh] flex-col gap-0 overflow-hidden rounded-2xl! p-0 shadow-2xl sm:max-w-xl"
    >
      <Command
        shouldFilter={false}
        dir={isAr ? "rtl" : "ltr"}
        className="flex min-h-0 flex-1 flex-col rounded-none! bg-transparent p-0"
      >
        {/* Search header — tall, borderless field with a leading magnifier
            and a trailing close button, matching a native command palette. */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t("search.placeholder")}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("close")}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <CommandList className="max-h-none min-h-0 flex-1 p-2">
          <CommandItem
            value="__new__"
            onSelect={handleNew}
            className="gap-3 px-3 py-2.5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <SquarePenIcon className="size-4" />
            </span>
            <span className="font-medium">{t("newConversation")}</span>
          </CommandItem>

          {showSkeleton && <ConversationSkeleton />}

          {showEmpty && <EmptyState hasSearch={hasSearch} />}

          {groups.map((group) => (
            <CommandGroup key={group.key} heading={group.label}>
              {group.items.map((c) => (
                <ConversationCommandItem
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  locale={locale}
                  highlightQuery={hasSearch ? debouncedQuery : ""}
                  onSelect={() => handleSelect(c.id)}
                />
              ))}
            </CommandGroup>
          ))}
        </CommandList>

        {/* Keyboard hint footer — the quiet finishing touch that signals the
            popup is arrow-key + Enter driven. */}
        <div className="flex shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <HintKey combo={["↑", "↓"]} label={t("search.hintNavigate")} />
          <HintKey combo={["↵"]} label={t("search.hintOpen")} />
          <HintKey combo={["Esc"]} label={t("close")} />
        </div>
      </Command>
    </CommandDialog>
  )
}

function ConversationCommandItem({
  conversation: c,
  active,
  locale,
  highlightQuery,
  onSelect,
}: {
  conversation: VendorAgentConversationSummary
  active: boolean
  locale: "ar" | "en"
  highlightQuery: string
  onSelect: () => void
}) {
  const t = useTranslations("aiChat")
  const isAr = locale === "ar"
  const titleText = c.title ?? t("conversations.untitled")

  return (
    <CommandItem
      value={c.id}
      onSelect={onSelect}
      className="items-center gap-3 px-3 py-2.5"
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground",
          active ? "bg-primary/10 text-primary" : "bg-muted",
        )}
      >
        <MessageSquareIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {highlight(titleText, highlightQuery)}
          </span>
          {active && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              {t("search.current")}
            </span>
          )}
        </span>
        {c.preview && (
          <span className="truncate text-xs text-muted-foreground">
            {highlight(c.preview, highlightQuery)}
          </span>
        )}
      </div>
      <span className="ms-1 shrink-0 text-[11px] text-muted-foreground">
        {formatDistanceToNow(new Date(c.updated_at), {
          addSuffix: true,
          locale: isAr ? ar : enUS,
        })}
      </span>
    </CommandItem>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  const t = useTranslations("aiChat.conversations")
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <MessageSquareIcon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">
        {hasSearch ? t("noMatches") : t("empty")}
      </p>
    </div>
  )
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 px-1 pt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HintKey({ combo, label }: { combo: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {combo.map((k) => (
          <kbd
            key={k}
            className="grid h-4 min-w-4 place-items-center rounded border border-border bg-muted px-1 font-sans text-[10px] leading-none text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  )
}

// ── Recency bucketing ─────────────────────────────────────────

interface RecencyGroup {
  key: string
  label: string
  items: VendorAgentConversationSummary[]
}

type RecencyKey = "results" | "today" | "yesterday" | "week" | "older"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Split conversations into Today / Yesterday / Previous 7 days / Older,
 * dropping empty buckets. During a search everything collapses into one
 * "Results" group so date headings don't fragment the matches.
 *
 * `label` names a bucket in the vendor's language (`aiChat.search.groups`).
 */
function groupByRecency(
  conversations: VendorAgentConversationSummary[],
  hasSearch: boolean,
  label: (key: RecencyKey) => string,
): RecencyGroup[] {
  if (hasSearch) {
    return conversations.length
      ? [{ key: "results", label: label("results"), items: conversations }]
      : []
  }

  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()

  const buckets: Record<string, VendorAgentConversationSummary[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }

  for (const c of conversations) {
    const t = new Date(c.updated_at).getTime()
    if (t >= startOfToday) buckets.today.push(c)
    else if (t >= startOfToday - DAY_MS) buckets.yesterday.push(c)
    else if (t >= startOfToday - 7 * DAY_MS) buckets.week.push(c)
    else buckets.older.push(c)
  }

  return (["today", "yesterday", "week", "older"] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: label(key), items: buckets[key] }))
}
