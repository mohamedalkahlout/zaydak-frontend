"use client"

import { Fragment, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Smile, AtSign, Hash, Paperclip, Loader2, User } from "lucide-react"
import { sileo } from "sileo"
import {
  GET_INVENTORY_TRANSFER_TIMELINE,
  ADD_INVENTORY_TRANSFER_COMMENT,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Textarea } from "@repo/ui/components/textarea"
import { cn } from "@/shared/lib/utils"
import { relativeTime, dayBucket } from "./transfer-helpers"

type TimelineEntry = {
  id: string
  action: string
  new_values?: Record<string, unknown> | null
  created_at: string
  user?: { id: string; name?: string | null } | null
}
type TimelineResp = {
  inventoryTransferTimeline: { success: boolean; data: TimelineEntry[] }
}

function initials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
}

/**
 * The transfer's activity feed — Shopify-style. A staff comment composer at the
 * top (wired to `addInventoryTransferComment`), then the audit-ledger events and
 * comments interleaved newest-first, grouped by day with relative timestamps.
 */
export function Timeline({
  transferId,
  locale,
}: {
  transferId: string
  locale: string
}) {
  const t = useTranslations("transfers.timeline")
  const tc = useTranslations("transfers.comments")
  const tToast = useTranslations("transfers.toast")
  const tRel = useTranslations("transfers.relTime")
  const [body, setBody] = useState("")

  const { data, loading } = useQuery<TimelineResp>(
    GET_INVENTORY_TRANSFER_TIMELINE,
    { variables: { id: transferId }, fetchPolicy: "cache-and-network" },
  )
  const entries = data?.inventoryTransferTimeline?.data ?? []

  const [addComment, { loading: posting }] = useMutation(
    ADD_INVENTORY_TRANSFER_COMMENT,
    {
      onCompleted: () => {
        setBody("")
        sileo.success({ title: tToast("commentAdded") })
      },
      onError: (err) => sileo.error({ title: err.message }),
      refetchQueries: [
        { query: GET_INVENTORY_TRANSFER_TIMELINE, variables: { id: transferId } },
      ],
    },
  )

  const post = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    void addComment({
      variables: { input: { transfer_id: transferId, body: trimmed } },
    })
  }

  const labelFor = (e: TimelineEntry): string => {
    const nv = (e.new_values ?? {}) as Record<string, unknown>
    if (e.action === "DELETE") return t("deleted")
    if (e.action === "CREATE")
      return nv.duplicated_from ? t("duplicated") : t("created")
    switch (nv.status) {
      case "READY_TO_SHIP":
        return t("ready")
      case "SENT":
        return t("sent")
      case "PARTIAL":
        return t("partial")
      case "RECEIVED":
        return t("received")
      case "CANCELLED":
        return t("cancelled")
      default:
        return t("updated")
    }
  }

  // Day-group the entries while preserving the newest-first order.
  const groups: Array<{ bucket: string; items: TimelineEntry[] }> = []
  for (const e of entries) {
    const bucket = dayBucket(e.created_at, (k) => tRel(k), locale)
    const last = groups[groups.length - 1]
    if (last && last.bucket === bucket) last.items.push(e)
    else groups.push({ bucket, items: [e] })
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-heading text-lg font-semibold">{t("title")}</h3>

      {/* Composer */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
          <Avatar />
          <div className="flex flex-1 flex-col gap-2">
            <Textarea
              rows={1}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post()
              }}
              placeholder={tc("placeholder")}
              className="min-h-9 resize-none border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ToolbarIcon icon={<Smile className="size-4" />} />
                <ToolbarIcon icon={<AtSign className="size-4" />} />
                <ToolbarIcon icon={<Hash className="size-4" />} />
                <ToolbarIcon icon={<Paperclip className="size-4" />} />
              </div>
              <Button
                size="sm"
                onClick={post}
                disabled={posting || !body.trim()}
              >
                {posting && <Loader2 className="size-3.5 animate-spin" />}
                {tc("post")}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-end text-xs text-muted-foreground">
          {tc("visibility")}
        </p>
      </div>

      {/* Feed */}
      {loading && entries.length === 0 ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.bucket} className="flex flex-col gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                {g.bucket}
              </div>
              <ol className="flex flex-col gap-3">
                {g.items.map((e) => {
                  const isComment = e.action === "COMMENT"
                  const comment = isComment
                    ? String((e.new_values as Record<string, unknown>)?.comment ?? "")
                    : null
                  return (
                    <li key={e.id} className="flex items-start gap-3">
                      {isComment ? (
                        <Avatar name={e.user?.name} small />
                      ) : (
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-foreground/30 ring-4 ring-background" />
                      )}
                      <div className="flex flex-1 flex-col">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="text-sm">
                            {isComment ? (
                              <span className="font-medium">
                                {e.user?.name ?? "—"}
                              </span>
                            ) : (
                              <>
                                {labelFor(e)}
                                {e.user?.name && (
                                  <span className="text-muted-foreground">
                                    {` · ${e.user.name}`}
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {relativeTime(e.created_at, (k, v) => tRel(k, v), locale)}
                          </span>
                        </div>
                        {comment && (
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            {comment}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolbarIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-md hover:bg-muted">
      {icon}
    </span>
  )
}

function Avatar({ name, small = false }: { name?: string | null; small?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-emerald-500 font-medium text-white",
        small ? "size-8 text-xs" : "size-9 text-sm",
      )}
    >
      {name ? initials(name).toUpperCase() : <User className="size-4" />}
    </span>
  )
}
