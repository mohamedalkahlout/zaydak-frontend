"use client"

import type { ReactNode } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { DELETE_SEGMENT, GET_SEGMENTS } from "@/features/segments/api"
import type {
  Segment,
  DeleteSegmentResponse,
} from "@/features/segments/types"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

interface DeleteSegmentDialogProps {
  segment: Pick<Segment, "id" | "name" | "coupons_count">
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteSegmentDialog({
  segment,
  open,
  onOpenChange,
  onDeleted,
}: DeleteSegmentDialogProps) {
  const t = useTranslations("segments.deleteDialog")
  const tc = useTranslations("common")
  const [deleteSegment, { loading }] = useMutation<DeleteSegmentResponse>(
    DELETE_SEGMENT,
    {
      refetchQueries: [
        { query: GET_SEGMENTS, variables: { page: 1, limit: 50 } },
      ],
    },
  )

  const handleDelete = async () => {
    try {
      const { data } = await deleteSegment({ variables: { id: segment.id } })
      if (data?.deleteCustomerSegment?.success) {
        sileo.success({
          title: t("deleted"),
          description: segment.name,
        })
        onOpenChange(false)
        onDeleted?.()
      } else if (data?.deleteCustomerSegment?.message) {
        sileo.error({
          title: t("deleteFailed"),
          description: data.deleteCustomerSegment.message,
        })
      }
    } catch (err) {
      sileo.error({
        title: t("deleteFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t.rich("body", { name: segment.name, b: strong })}
            {segment.coupons_count > 0 && (
              <>
                {" "}
                {t.rich("linkedCoupons", {
                  count: segment.coupons_count,
                  b: strong,
                })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("deleting") : tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
