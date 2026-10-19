"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery } from "@apollo/client/react"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckSquareIcon,
  HistoryIcon,
  LockIcon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Share2Icon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet"
import {
  VENDOR_AGENT_ARCHIVED_CONVERSATIONS,
  VENDOR_AGENT_CONVERSATIONS,
} from "@/features/ai/api/queries"
import { highlight } from "@/features/ai/lib/highlight"
import { BULK_DELETE_VENDOR_AGENT_CONVERSATIONS, BULK_PIN_VENDOR_AGENT_CONVERSATIONS, DELETE_VENDOR_AGENT_CONVERSATION, PIN_VENDOR_AGENT_CONVERSATION, RENAME_VENDOR_AGENT_CONVERSATION, RESTORE_VENDOR_AGENT_CONVERSATION, SHARE_VENDOR_AGENT_CONVERSATION } from "@/features/ai/api"
import type {
  VendorAgentConversationsResponse,
  VendorAgentConversationSummary,
} from "@/features/ai/lib/types"

interface Props {
  activeId: string | null
  /** The side the sheet opens from, and the relative-time locale. */
  locale: "ar" | "en"
  onSwitch: (id: string) => void | Promise<void>
  onNewChat: () => void
}

export function ConversationsSidebar({
  activeId,
  locale,
  onSwitch,
  onNewChat,
}: Props) {
  const t = useTranslations("aiChat")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  // "active" = live conversations, "archived" = recently auto-archived
  // (or manually deleted) within the recovery window. Each tab keeps
  // its own row interactions: archived rows expose a Restore action
  // instead of edit/share.
  const [tab, setTab] = useState<"active" | "archived">("active")
  const isAr = locale === "ar"
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Per-row UI modes live here instead of on each row so only ONE can
  // be active at a time and Escape cleanly cancels everywhere.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Debounce so fast typing doesn't spam the backend. 250ms feels
  // instant while collapsing bursts from a paste or arrow-through-word.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // Focus search when sidebar opens — scoped to avoid hijacking the
  // focus on every re-render.
  useEffect(() => {
    if (open) {
      // RAF so the input exists after Sheet renders its content.
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [open])

  // Refs for the keyboard shortcut handler — declared here so the
  // useEffect below can reach them. The actual handler is registered
  // AFTER `filtered` is defined further down the component, since it
  // reads the current visible list.
  const jumpPrimedRef = useRef(false)
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, loading, refetch } =
    useQuery<VendorAgentConversationsResponse>(VENDOR_AGENT_CONVERSATIONS, {
      variables: { search: debouncedQuery.trim() || null },
      fetchPolicy: "cache-and-network",
      skip: !open || tab !== "active",
    })

  // Archived view shares the same response shape; only the row
  // affordances differ. Lazy-fetched only when the tab is open.
  const {
    data: archivedData,
    loading: archivedLoading,
    refetch: refetchArchived,
  } = useQuery<{
    vendorAgentArchivedConversations: VendorAgentConversationsResponse["vendorAgentConversations"]
  }>(VENDOR_AGENT_ARCHIVED_CONVERSATIONS, {
    fetchPolicy: "cache-and-network",
    skip: !open || tab !== "archived",
  })

  const [restoreMutation] = useMutation<{
    restoreVendorAgentConversation: { success: boolean }
  }>(RESTORE_VENDOR_AGENT_CONVERSATION)

  const [deleteMutation, { loading: deleting }] = useMutation<{
    deleteVendorAgentConversation: { success: boolean }
  }>(DELETE_VENDOR_AGENT_CONVERSATION)
  const [pinMutation] = useMutation<{
    pinVendorAgentConversation: { success: boolean }
  }>(PIN_VENDOR_AGENT_CONVERSATION)
  const [renameMutation] = useMutation<{
    renameVendorAgentConversation: { success: boolean }
  }>(RENAME_VENDOR_AGENT_CONVERSATION)
  const [bulkDeleteMutation] = useMutation<{
    bulkDeleteVendorAgentConversations: { success: boolean }
  }>(BULK_DELETE_VENDOR_AGENT_CONVERSATIONS)
  const [bulkPinMutation] = useMutation<{
    bulkPinVendorAgentConversations: { success: boolean }
  }>(BULK_PIN_VENDOR_AGENT_CONVERSATIONS)
  const [shareMutation] = useMutation<{
    shareVendorAgentConversation: {
      token: string
      url: string
      expires_at: string | null
    }
  }>(SHARE_VENDOR_AGENT_CONVERSATION)

  // Transient feedback after a share: id → "Link copied!" banner that
  // fades after a moment. Kept in local state (not toast library) so
  // the component stays self-contained.
  const [sharedId, setSharedId] = useState<string | null>(null)

  // TTL picker — when the vendor clicks Share, we briefly surface a
  // tiny menu (Never / 1d / 7d / 30d) anchored under the row. Picking
  // an option fires the mutation. Closes on outside click.
  const [shareMenuId, setShareMenuId] = useState<string | null>(null)

  // Server-side filtering (via the `search` query arg) replaced the
  // in-memory title+preview match — the results now also include
  // message-body hits and bring the matching message as the preview.
  // Switch the row source based on the active tab. Both queries return
  // the same ConversationSummary shape, so the row component reuses
  // unchanged.
  const filtered =
    tab === "archived"
      ? (archivedData?.vendorAgentArchivedConversations ?? [])
      : (data?.vendorAgentConversations ?? [])
  const conversations = filtered
  const isLoading = tab === "archived" ? archivedLoading : loading
  // Search is wired to the active list only — archive view doesn't
  // search (small recovery window, scrolling beats querying).
  const hasActiveSearch =
    tab === "active" && debouncedQuery.trim().length > 0

  // Power-user shortcuts active only while the drawer is open and
  // focus isn't trapped in an input/textarea:
  //   /         → focus the search field
  //   g 1..9    → jump to the Nth conversation in the visible list
  //                (Vim-style "go to" prefix; clears after 1.2s if
  //                 you don't follow up with a digit)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      const tag = active?.tagName?.toLowerCase()
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        (active as HTMLElement | null)?.isContentEditable
      if (isEditable) return

      if (e.key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // "g" primes the jump prefix — next digit selects.
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        jumpPrimedRef.current = true
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
        jumpTimerRef.current = setTimeout(() => {
          jumpPrimedRef.current = false
        }, 1200)
        return
      }

      if (jumpPrimedRef.current && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const idx = parseInt(e.key, 10) - 1
        const target = filtered[idx]
        if (target) {
          setOpen(false)
          // Clear all selection/edit/share modes so the next view
          // mounts fresh — same convention as the click-pick path.
          setSelectMode(false)
          setSelectedIds(new Set())
          setEditingId(null)
          void onSwitch(target.id)
        }
        jumpPrimedRef.current = false
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
        return
      }

      // Any other key clears the prime (avoids "g h" sticking).
      if (jumpPrimedRef.current) {
        jumpPrimedRef.current = false
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
    }
    // `filtered` is read inside the handler — re-bind when the list
    // changes so `g 3` always points at the current third row.
  }, [open, filtered, onSwitch])

  const resetSelectionModes = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setEditingId(null)
  }

  const handlePick = async (id: string) => {
    if (selectMode || editingId) return
    setOpen(false)
    resetSelectionModes()
    await onSwitch(id)
  }

  const handleNew = () => {
    setOpen(false)
    resetSelectionModes()
    onNewChat()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (
    e: React.MouseEvent,
    c: VendorAgentConversationSummary,
  ) => {
    e.stopPropagation()
    if (deleting) return
    await deleteMutation({ variables: { id: c.id } })
    if (c.id === activeId) onNewChat()
    await refetch()
  }

  const handleTogglePin = async (
    e: React.MouseEvent,
    c: VendorAgentConversationSummary,
  ) => {
    e.stopPropagation()
    await pinMutation({ variables: { id: c.id, pinned: !c.pinned_at } })
    await refetch()
  }

  const handleRestore = async (
    e: React.MouseEvent,
    c: VendorAgentConversationSummary,
  ) => {
    e.stopPropagation()
    await restoreMutation({ variables: { id: c.id } })
    // Restored row leaves the archived view; reflect that immediately
    // by refetching, and refresh the active list too in case the user
    // jumps tabs.
    await Promise.all([refetchArchived(), refetch()])
  }

  // Step 1 of share flow: open the TTL picker. The actual mutation
  // fires from `pickShareTtl` once the vendor chooses an expiry.
  const openShareMenu = (
    e: React.MouseEvent,
    c: VendorAgentConversationSummary,
  ) => {
    e.stopPropagation()
    setShareMenuId(c.id === shareMenuId ? null : c.id)
  }

  // Step 2: vendor picked a TTL (or "never"). Mint the link, copy it,
  // close the menu, and flash confirmation. When `pin` is provided
  // (non-empty), the link is PIN-gated — recipient must enter it on
  // /share before the transcript loads.
  const pickShareTtl = async (
    c: VendorAgentConversationSummary,
    ttlDays: number | null,
    pin?: string,
  ) => {
    setShareMenuId(null)
    const { data: result } = await shareMutation({
      variables: {
        id: c.id,
        ttl_days: ttlDays ?? null,
        pin: pin ?? null,
      },
    })
    const url = result?.shareVendorAgentConversation?.url
    if (!url) return
    // Pin in the toast so the vendor sees what to send the recipient.
    // Stored only in transient toast state — never persisted client-side.
    const composed = pin ? `${url}\nPIN: ${pin}` : url
    try {
      await navigator.clipboard?.writeText(composed)
      setSharedId(c.id)
      setTimeout(() => setSharedId(null), 2500)
    } catch {
      window.prompt(t("sidebar.copyLinkPrompt"), composed)
    }
  }

  const handleStartRename = (
    e: React.MouseEvent,
    c: VendorAgentConversationSummary,
  ) => {
    e.stopPropagation()
    setEditingId(c.id)
  }

  const handleSaveRename = async (id: string, nextTitle: string) => {
    setEditingId(null)
    await renameMutation({ variables: { id, title: nextTitle } })
    await refetch()
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await bulkDeleteMutation({ variables: { ids } })
    if (activeId && ids.includes(activeId)) onNewChat()
    resetSelectionModes()
    await refetch()
  }

  const handleBulkPin = async (pinned: boolean) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await bulkPinMutation({ variables: { ids, pinned } })
    resetSelectionModes()
    await refetch()
  }

  const triggerLabel = t("sidebar.trigger")

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetSelectionModes()
      }}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={triggerLabel}
            className="text-muted-foreground">
            <HistoryIcon className="size-4 sm:me-1.5" />
            <span className="hidden sm:inline">{triggerLabel}</span>
          </Button>
        }
      />
      <SheetContent side={isAr ? "left" : "right"} className="p-0 flex flex-col">
        <SheetHeader className="border-b flex-row items-center justify-between pe-4">
          <SheetTitle>{t("sidebar.title")}</SheetTitle>
          {conversations.length > 0 && tab === "active" && (
            <button
              type="button"
              onClick={() => {
                if (selectMode) resetSelectionModes()
                else setSelectMode(true)
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition">
              {selectMode ? tCommon("cancel") : t("sidebar.select")}
            </button>
          )}
        </SheetHeader>

        {/* Tab toggle. Active = live conversations. Archived = recently
            auto-archived/deleted, restorable within the recovery window. */}
        <div className="px-3 pt-3 flex gap-1 shrink-0" dir="ltr">
          <TabButton
            active={tab === "active"}
            onClick={() => {
              setTab("active")
              resetSelectionModes()
            }}
            icon={<MessageSquareIcon className="size-3.5" />}
            label={t("sidebar.tabActive")}
          />
          <TabButton
            active={tab === "archived"}
            onClick={() => {
              setTab("archived")
              resetSelectionModes()
            }}
            icon={<ArchiveIcon className="size-3.5" />}
            label={t("sidebar.tabArchived")}
          />
        </div>

        <div className="p-3 space-y-2 shrink-0">
          <Button
            onClick={handleNew}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={selectMode || tab === "archived"}>
            <PlusIcon className="size-4 me-2" />
            {t("conversations.newChat")}
          </Button>
          <div className="relative">
            <SearchIcon className="size-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("sidebar.searchPlaceholder")}
              className="h-8 ps-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {isLoading && conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("sidebar.loading")}
            </p>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
              <MessageSquareIcon className="size-6 mx-auto opacity-50" />
              <p>
                {hasActiveSearch
                  ? t("conversations.noMatches")
                  : t("conversations.empty")}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((c, idx) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  locale={locale}
                  highlightQuery={hasActiveSearch ? debouncedQuery : ""}
                  justShared={sharedId === c.id}
                  jumpHintNumber={
                    tab === "active" && idx < 9 ? idx + 1 : null
                  }
                  // Archived rows expose only Restore — hide the rest.
                  archived={tab === "archived"}
                  onRestore={(e) => void handleRestore(e, c)}
                  shareMenuOpen={shareMenuId === c.id}
                  onPickShareTtl={(ttlDays, pin) =>
                    void pickShareTtl(c, ttlDays, pin)
                  }
                  selectMode={selectMode}
                  selected={selectedIds.has(c.id)}
                  editing={editingId === c.id}
                  onToggleSelect={() => toggleSelect(c.id)}
                  onPick={() => void handlePick(c.id)}
                  onPin={(e) => void handleTogglePin(e, c)}
                  onShare={(e) => openShareMenu(e, c)}
                  onDelete={(e) => void handleDelete(e, c)}
                  onStartRename={(e) => handleStartRename(e, c)}
                  onSaveRename={(title) => void handleSaveRename(c.id, title)}
                  onCancelRename={() => setEditingId(null)}
                />
              ))}
            </ul>
          )}
        </div>

        {selectMode && (
          <BulkActionsBar
            count={selectedIds.size}
            onDelete={() => void handleBulkDelete()}
            onPin={() => void handleBulkPin(true)}
            onUnpin={() => void handleBulkPin(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Row ───────────────────────────────────────────────────

interface RowProps {
  conversation: VendorAgentConversationSummary
  active: boolean
  /** The relative-time locale ("3 hours ago"). */
  locale: "ar" | "en"
  highlightQuery: string
  justShared: boolean
  /** 1-9 for the first nine visible rows (matches the `g + N` shortcut),
   *  null for everything past row 9. */
  jumpHintNumber: number | null
  /** True when this row lives in the archived tab — collapses the row's
   *  affordances down to a single Restore button. */
  archived: boolean
  onRestore: (e: React.MouseEvent) => void
  shareMenuOpen: boolean
  onPickShareTtl: (ttlDays: number | null, pin?: string) => void
  selectMode: boolean
  selected: boolean
  editing: boolean
  onToggleSelect: () => void
  onPick: () => void
  onPin: (e: React.MouseEvent) => void
  onShare: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onStartRename: (e: React.MouseEvent) => void
  onSaveRename: (title: string) => void
  onCancelRename: () => void
}

function ConversationRow({
  conversation: c,
  active,
  locale,
  highlightQuery,
  justShared,
  jumpHintNumber,
  archived,
  onRestore,
  shareMenuOpen,
  onPickShareTtl,
  selectMode,
  selected,
  editing,
  onToggleSelect,
  onPick,
  onPin,
  onShare,
  onDelete,
  onStartRename,
  onSaveRename,
  onCancelRename,
}: RowProps) {
  const t = useTranslations("aiChat")
  const tCommon = useTranslations("common")
  const inputRef = useRef<HTMLInputElement>(null)
  const titleText = c.title ?? t("conversations.untitled")

  // Rows are <div> (not <button>) so we can nest form controls inside
  // in select/edit mode without invalid HTML.
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (editing) return
          if (selectMode) onToggleSelect()
          else onPick()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (editing) return
            if (selectMode) onToggleSelect()
            else onPick()
          }
        }}
        className={cn(
          "group w-full text-start rounded-lg px-3 py-2 transition hover:bg-muted cursor-pointer",
          active && !selectMode && "bg-muted",
          selected && "bg-primary/10 hover:bg-primary/15",
        )}>
        <div className="flex items-start gap-2">
          {selectMode && (
            <div className="pt-0.5 shrink-0">
              {selected ? (
                <CheckSquareIcon className="size-4 text-primary" />
              ) : (
                <SquareIcon className="size-4 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                ref={(el) => {
                  inputRef.current = el
                  // Auto-focus + select-all on first render in edit mode
                  // so the vendor can just start typing.
                  if (el && document.activeElement !== el) {
                    el.focus()
                    el.select()
                  }
                }}
                type="text"
                defaultValue={c.title ?? ""}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSaveRename(
                      (e.currentTarget as HTMLInputElement).value,
                    )
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    onCancelRename()
                  }
                }}
                onBlur={(e) => onSaveRename(e.currentTarget.value)}
                className="text-sm font-medium w-full bg-background border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t("sidebar.titlePlaceholder")}
              />
            ) : (
              <div className="text-sm font-medium truncate">
                {highlight(titleText, highlightQuery)}
              </div>
            )}
            {!editing && c.preview && (
              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                {highlight(c.preview, highlightQuery)}
              </div>
            )}
            {!editing && (
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                <span>
                  {formatDistanceToNow(new Date(c.updated_at), {
                    addSuffix: true,
                    locale: locale === "ar" ? ar : enUS,
                  })}
                </span>
                <span>·</span>
                <span>
                  {t("sidebar.messageCount", { count: c.message_count })}
                </span>
                {c.is_shared && (
                  <ShareBadge
                    expiresAt={c.share_expires_at}
                    hasPin={c.has_share_pin}
                  />
                )}
                {jumpHintNumber !== null && (
                  // Hover-only chip teaching the `g + N` shortcut.
                  // ms-auto pushes it to the trailing edge so it
                  // doesn't disrupt the timestamp+count rhythm.
                  <span className="ms-auto opacity-0 group-hover:opacity-100 transition rounded border border-muted-foreground/20 bg-muted/40 px-1 py-0 font-mono text-[9px] text-muted-foreground">
                    g {jumpHintNumber}
                  </span>
                )}
              </div>
            )}
            {justShared && (
              <div className="mt-1 text-[10px] text-emerald-600 font-medium">
                {t("sidebar.linkCopied")}
              </div>
            )}
            {shareMenuOpen && (
              <ShareMenu
                isShared={c.is_shared}
                onPick={(ttl, pin) => onPickShareTtl(ttl, pin)}
              />
            )}
          </div>

          {!selectMode && !editing && archived && (
            // Archived rows collapse the action cluster down to a
            // single Restore button. Pin/share/rename/delete are
            // meaningless on a soft-deleted row.
            <div className="flex items-start gap-0.5">
              <button
                type="button"
                onClick={onRestore}
                className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 transition"
                aria-label={t("sidebar.restore")}>
                <ArchiveRestoreIcon className="size-3.5" />
              </button>
            </div>
          )}
          {!selectMode && !editing && !archived && (
            <div className="flex items-start gap-0.5">
              <button
                type="button"
                onClick={onPin}
                className={cn(
                  "p-1 rounded hover:bg-muted-foreground/10 transition",
                  c.pinned_at
                    ? "opacity-100 text-amber-500"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground",
                )}
                aria-label={
                  c.pinned_at ? t("sidebar.unpin") : t("sidebar.pin")
                }>
                <PinIcon
                  className={cn("size-3.5", c.pinned_at && "fill-current")}
                />
              </button>
              <button
                type="button"
                onClick={onStartRename}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted-foreground/10 transition"
                aria-label={t("sidebar.rename")}>
                <PencilIcon className="size-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={onShare}
                className={cn(
                  "p-1 rounded hover:bg-muted-foreground/10 transition",
                  // Stays visible for 2s after a successful copy so the
                  // vendor sees the confirmation even if they've moved
                  // the cursor off the row.
                  justShared
                    ? "opacity-100 text-emerald-600"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground",
                )}
                aria-label={t("sidebar.share")}>
                <Share2Icon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition"
                aria-label={tCommon("delete")}>
                <Trash2Icon className="size-3.5 text-destructive" />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function ShareBadge({
  expiresAt,
  hasPin,
}: {
  expiresAt: string | null
  hasPin: boolean
}) {
  const t = useTranslations("aiChat.sidebar")
  // `Date.now()` read during render is impure — the same props would produce
  // different output on two renders of the same commit. Anchored once per
  // mount instead: the label buckets to whole days, so it has no reason to
  // tick, and a share list refetch remounts these rows anyway.
  const [now] = useState(() => Date.now())
  // Compute remaining time. We bucket into "expired", "today",
  // "<N days", "active" (no expiry) so the label stays scannable
  // — exact ISO timestamps in a sidebar are noise.
  let label: string
  let toneExpired = false
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - now
    if (ms <= 0) {
      label = t("shareExpired")
      toneExpired = true
    } else {
      const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
      label = t("shareDaysLeft", { days })
    }
  } else {
    label = t("shareActive")
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
        toneExpired
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}>
      <Share2Icon className="size-2.5" />
      {label}
      {/* Lock when the link is PIN-gated. Stacks after the label so the
          time/state info reads first. */}
      {hasPin && (
        <LockIcon
          className="size-2.5 opacity-80"
          aria-label={t("pinProtected")}
        />
      )}
    </span>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Borderless pill that highlights when active. Equal flex weight
      // so the two tabs split the row evenly even with different
      // label lengths.
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}>
      {icon}
      {label}
    </button>
  )
}

function ShareTtlButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-md hover:bg-muted transition">
      {label}
    </button>
  )
}

/**
 * Share-options popover. Two stacked rows:
 *   1. expiry (Never / 24h / 7d / 30d)
 *   2. optional PIN protection — toggled via a checkbox; when on,
 *      reveals a 4+ char input. PIN is sent to the server hashed
 *      (bcrypt) and never stored client-side.
 */
function ShareMenu({
  isShared,
  onPick,
}: {
  /** Whether this conversation already has an active share token. We
   *  use it to expose a quick "remove PIN" action — vendors who want
   *  to clear an existing PIN just click that and skip the form. */
  isShared: boolean
  onPick: (ttl: number | null, pin?: string) => void
}) {
  const t = useTranslations("aiChat.sidebar")
  const [pinEnabled, setPinEnabled] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = (ttl: number | null) => {
    if (pinEnabled) {
      if (pin.trim().length < 4) {
        setError(t("pinTooShort"))
        return
      }
      onPick(ttl, pin.trim())
    } else {
      onPick(ttl)
    }
  }

  // Empty-string pin = explicit "clear" on the backend. Used by the
  // remove-PIN affordance so the vendor can drop protection without
  // needing to also pick a TTL.
  const removePin = () => onPick(null, "")

  return (
    <div
      className="mt-2 rounded-lg border bg-popover shadow-md p-2 space-y-2"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1">
        <ShareTtlButton label={t("ttlNever")} onClick={() => submit(null)} />
        <ShareTtlButton label={t("ttlDay")} onClick={() => submit(1)} />
        <ShareTtlButton label={t("ttlWeek")} onClick={() => submit(7)} />
        <ShareTtlButton label={t("ttlMonth")} onClick={() => submit(30)} />
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={pinEnabled}
          onChange={(e) => {
            setPinEnabled(e.target.checked)
            if (!e.target.checked) {
              setPin("")
              setError(null)
            }
          }}
          className="size-3 cursor-pointer"
        />
        {t("protectWithPin")}
      </label>
      {pinEnabled && (
        <div className="space-y-1">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError(null)
            }}
            placeholder={t("pinPlaceholder")}
            className="h-7 text-xs w-full rounded-md border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {error && (
            <p className="text-[10px] text-destructive">{error}</p>
          )}
        </div>
      )}
      {isShared && (
        <button
          type="button"
          onClick={removePin}
          className="text-[10px] text-muted-foreground hover:text-foreground transition w-full text-start pt-1 border-t">
          {t("removePin")}
        </button>
      )}
    </div>
  )
}

// ── Bulk actions bar ──────────────────────────────────────

function BulkActionsBar({
  count,
  onDelete,
  onPin,
  onUnpin,
}: {
  count: number
  onDelete: () => void
  onPin: () => void
  onUnpin: () => void
}) {
  const t = useTranslations("aiChat.sidebar")
  const tCommon = useTranslations("common")
  const disabled = count === 0

  return (
    <div className="border-t p-3 flex items-center gap-2 shrink-0 bg-background">
      <span className="text-xs font-medium text-muted-foreground">
        {t("selectedCount", { count })}
      </span>
      <div className="ms-auto flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onPin}
          className="h-8">
          <PinIcon className="size-3.5 me-1" />
          {t("bulkPin")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onUnpin}
          className="h-8">
          <XIcon className="size-3.5 me-1" />
          {t("bulkUnpin")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={disabled}
          onClick={onDelete}
          className="h-8">
          <Trash2Icon className="size-3.5 me-1" />
          {tCommon("delete")}
        </Button>
      </div>
    </div>
  )
}
