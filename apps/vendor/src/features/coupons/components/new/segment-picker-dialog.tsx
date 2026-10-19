"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { BanIcon, SearchIcon, UsersIcon } from "lucide-react"
import { GET_SEGMENTS } from "@/features/segments/api"
import type { Segment, SegmentsResponse } from "@/features/segments/types"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"

interface SegmentPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (
    ids: string[],
    snapshots: Record<string, { name: string }>,
  ) => void
  maxSelection?: number
}

/**
 * Multi-select picker for `SEGMENT` eligibility coupons. Fetches the first
 * page of `customerSegments` and filters client-side — the backend supports
 * a `search` arg but for typical shops (<200 segments) a fetch-all + local
 * filter avoids the round-trip on every keystroke.
 *
 * Mirrors `CustomerPickerDialog` deliberately: same row shape, same
 * confirm/cancel semantics, same selection cap, so the two pickers feel
 * identical from the vendor's perspective.
 */
export function SegmentPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  maxSelection = 20,
}: SegmentPickerDialogProps) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
  }

  const { data, loading } = useQuery<SegmentsResponse>(GET_SEGMENTS, {
    variables: { page: 1, limit: 100 },
    skip: !open,
    fetchPolicy: "cache-and-network",
  })

  const rows = useMemo<Segment[]>(
    () => data?.customerSegments?.data ?? [],
    [data],
  )
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    )
  }, [rows, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelection) {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const snapshots: Record<string, { name: string }> = {}
    for (const r of rows) {
      if (selected.has(r.id)) snapshots[r.id] = { name: r.name }
    }
    onConfirm(Array.from(selected), snapshots)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelected(new Set(value))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("segmentPicker.title")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("segmentPicker.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && visible.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("segmentPicker.empty")}</p>
              <p className="text-xs">{t("segmentPicker.emptyHint")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((r) => {
                const checked = selected.has(r.id)
                return (
                  <li key={r.id}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(r.id)}
                      />
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        <UsersIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.name}
                        </p>
                        {r.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {r.description}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {t("segmentPicker.selected", {
              selected: selected.size,
              max: maxSelection,
            })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {t("pickers.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
