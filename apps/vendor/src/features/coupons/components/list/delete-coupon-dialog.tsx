"use client"

import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { DELETE_COUPON } from "@/features/coupons/api"
import type { Coupon } from "@/features/coupons/types"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

interface DeleteResponse {
  deleteCoupon: { success: boolean; message?: string | null }
}

interface DeleteCouponDialogProps {
  coupon: Coupon
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCouponDialog({
  coupon,
  open,
  onOpenChange,
}: DeleteCouponDialogProps) {
  const t = useTranslations("coupons.deleteDialog")
  const tToasts = useTranslations("coupons.toasts")
  const tCommon = useTranslations("common")
  const [deleteCoupon, { loading }] = useMutation<DeleteResponse>(
    DELETE_COUPON,
    {
      refetchQueries: "active",
    },
  )

  const handleDelete = async () => {
    try {
      const { data } = await deleteCoupon({ variables: { id: coupon.id } })
      if (data?.deleteCoupon?.success) {
        sileo.success({
          title: t("deleted"),
          description: coupon.code,
        })
        onOpenChange(false)
      } else if (data?.deleteCoupon?.message) {
        sileo.error({
          title: t("failed"),
          description: data.deleteCoupon.message,
        })
      }
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : tToasts("tryAgain"),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t.rich("description", {
              code: coupon.code,
              b: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("deleting") : tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
