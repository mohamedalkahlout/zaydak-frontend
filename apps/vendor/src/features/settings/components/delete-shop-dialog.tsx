"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

import { DELETE_SHOP, GET_MY_SHOPS } from "@/features/shops/api"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  hasValidationCode,
  validationMessage,
} from "@/shared/lib/validation-errors"

/**
 * Confirms soft-deleting the current shop from Settings > General.
 *
 * The mutation is ownership-scoped soft delete only — `deleted_at` +
 * `is_active: false`. There is no vendor hard-delete path. After success the
 * active shop is cleared and the vendor lands on `/shops`, so nothing keeps
 * sending `X-SHOP` for a store they can no longer open. Platform staff restore
 * via admin `restoreShops`; the copy says so rather than promising a vendor
 * undo.
 *
 * Open orders refuse the delete (`SHOP_HAS_ACTIVE_ORDERS`); that surfaces as
 * its own sentence rather than the generic "Validation failed".
 */
export function DeleteShopDialog({
  shop,
  open,
  onOpenChange,
}: {
  shop: { name: string; slug: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.general.deleteStore")
  const router = useRouter()
  const [shown, setShown] = useState(shop)
  if (open && shop !== shown) setShown(shop)

  const [deleteShop, { loading }] = useMutation(DELETE_SHOP, {
    refetchQueries: [{ query: GET_MY_SHOPS }],
    awaitRefetchQueries: true,
  })

  async function confirm() {
    if (loading) return
    try {
      const result = await deleteShop({ variables: { slug: shop.slug } })
      const ok = (
        result.data as { deleteShop?: { success?: boolean } } | undefined
      )?.deleteShop?.success
      if (!ok) throw new Error(t("failed"))

      // Discard any staged General edits so leave-guard does not intercept the
      // redirect to `/shops` after a deliberate destructive confirm.
      useLeaveGuardStore.getState().guard?.onLeave()
      useLeaveGuardStore.getState().disarm()
      useUnsavedBarStore.getState().hide()
      useActiveShopStore.getState().clear()

      sileo.success({ title: t("done"), description: shown.name })
      onOpenChange(false)
      router.replace("/shops")
    } catch (err) {
      const title = hasValidationCode(err, "SHOP_HAS_ACTIVE_ORDERS")
        ? t("activeOrders")
        : validationMessage(err, t("failed"))
      sileo.error({ title })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { name: shown.name })}</DialogTitle>
          <DialogDescription>
            {t("dialogBody", { name: shown.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirm()}
            disabled={loading}
          >
            {loading ? t("deleting") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
