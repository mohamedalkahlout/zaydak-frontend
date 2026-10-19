"use client"

import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { DELETE_PRODUCT } from "@/features/products/api"
import type { DeleteProductResponse } from "@/features/products/types"

interface DeleteProductDialogProps {
  productId: string
  /** Already-resolved display name — the header watches the form for it. */
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the caller goes next; the editor leaves for the list. */
  onDeleted?: () => void
}

/**
 * Confirm before `deleteProduct`. The dashboard had no way to remove a
 * product at all until this dialog — the mutation existed on the API and no
 * screen called it.
 *
 * The copy says "removed from your shop" rather than "permanently", because
 * the server soft-deletes: the row keeps its history so past orders still
 * resolve the product they were placed against.
 */
export function DeleteProductDialog({
  productId,
  name,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProductDialogProps) {
  const t = useTranslations("products.delete")
  const tCommon = useTranslations("common")
  const [deleteProduct, { loading }] = useMutation<DeleteProductResponse>(
    DELETE_PRODUCT,
    { refetchQueries: "active" },
  )

  const handleDelete = async () => {
    try {
      const res = await deleteProduct({ variables: { id: productId } })
      if (res.data?.deleteProduct?.success) {
        sileo.success({ title: t("deleted"), description: name })
        onOpenChange(false)
        onDeleted?.()
        return
      }
      sileo.error({
        title: t("failed"),
        description: res.data?.deleteProduct?.message ?? t("rejected"),
      })
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t.rich("body", {
              name: name || t("thisProduct"),
              b: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            }
          />
          <Button
            variant="destructive"
            size="sm"
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
