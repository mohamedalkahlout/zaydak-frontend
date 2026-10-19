"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Label } from "@repo/ui/components/label"
import { Textarea } from "@repo/ui/components/textarea"
import { GET_SHOP_REVIEWS_SUMMARY, REPORT_REVIEW } from "@/features/reviews/api"
import type { ReportReviewResponse, ShopReview } from "@/features/reviews/types"

interface ReportReviewDialogProps {
  review: ShopReview
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_REASON = 500

/**
 * Flags a review for platform moderation.
 *
 * The merchant cannot delete a review of their own shop — `deleteReview` is
 * gated on `manage_all_shops` — so this is the escalation path, and the copy
 * says so plainly rather than implying the review disappears. The report is a
 * single explicit submit, so no save bar is involved.
 */
export function ReportReviewDialog({
  review,
  open,
  onOpenChange,
}: ReportReviewDialogProps) {
  const t = useTranslations("reviews")
  const [reason, setReason] = useState("")

  const [reportReview, { loading }] = useMutation<ReportReviewResponse>(
    REPORT_REVIEW,
    {
      // The summary card counts reported reviews; the list row shows the badge.
      // Refetch the summary only — re-running the list would reset the page the
      // merchant is standing on.
      refetchQueries: [{ query: GET_SHOP_REVIEWS_SUMMARY }],
    },
  )

  const handleSubmit = async () => {
    try {
      await reportReview({
        variables: {
          input: {
            model_type: "review",
            model_id: review.id,
            message: reason.trim() || undefined,
          },
        },
      })
      sileo.success({ title: t("report.success") })
      setReason("")
      onOpenChange(false)
    } catch (err) {
      sileo.error({
        title: t("report.error"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report.title")}</DialogTitle>
          <DialogDescription>{t("report.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="report-reason">{t("report.reason")}</Label>
          <Textarea
            id="report-reason"
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("report.reasonPlaceholder")}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {t("report.reasonHint", {
              remaining: MAX_REASON - reason.length,
            })}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("report.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? t("report.submitting") : t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
