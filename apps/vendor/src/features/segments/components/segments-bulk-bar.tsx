"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { TrashIcon, XIcon } from "lucide-react"
import { sileo } from "sileo"
import { DELETE_SEGMENT, GET_SEGMENTS } from "@/features/segments/api"
import type { DeleteSegmentResponse } from "@/features/segments/types"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

/**
 * Banner that replaces the toolbar when one or more rows are selected.
 * Matches Shopify's pattern:
 *
 *   ☑ 3 selected           [Clear selection]    [⋯ Bulk delete]
 *
 * Bulk delete fires DELETE_SEGMENT for each selected id sequentially
 * (the backend doesn't expose a single bulk-delete mutation yet — that's
 * a minor follow-up if delete latency starts mattering).
 */

interface SegmentsBulkBarProps {
  selectedIds: string[]
  onClear: () => void
}

export function SegmentsBulkBar({ selectedIds, onClear }: SegmentsBulkBarProps) {
  const t = useTranslations("segments.bulkBar")
  const tc = useTranslations("common")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteSegment, { loading: deleting }] = useMutation<DeleteSegmentResponse>(
    DELETE_SEGMENT,
    {
      refetchQueries: [
        { query: GET_SEGMENTS, variables: { page: 1, limit: 50 } },
      ],
    },
  )

  const handleConfirm = async () => {
    let ok = 0
    let failed = 0
    for (const id of selectedIds) {
      try {
        const { data } = await deleteSegment({ variables: { id } })
        if (data?.deleteCustomerSegment?.success) ok++
        else failed++
      } catch {
        failed++
      }
    }
    if (ok > 0) {
      sileo.success({ title: t("deleted", { count: ok }) })
    }
    if (failed > 0) {
      sileo.error({ title: t("deleteFailed", { count: failed }) })
    }
    setConfirmOpen(false)
    onClear()
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">
            {t("selected", { count: selectedIds.length })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7"
          >
            <XIcon className="mr-1 size-3.5" />
            {tc("clear")}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="text-destructive hover:bg-destructive/10"
          disabled={deleting}
        >
          <TrashIcon className="mr-1 size-3.5" />
          {tc("delete")}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("confirmTitle", { count: selectedIds.length })}
            </DialogTitle>
            <DialogDescription>{t("confirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? t("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
