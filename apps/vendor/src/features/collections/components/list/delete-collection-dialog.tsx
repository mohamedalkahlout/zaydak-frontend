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
import { DELETE_SHOP_COLLECTION } from "@/features/collections/api"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type { ShopCollection } from "@/features/collections/types"
import { collectionName } from "@/features/collections/lib/list/helpers"

interface DeleteCollectionDialogProps {
  collection: ShopCollection
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the caller goes next. The editor leaves for the list; a row stays. */
  onDeleted?: () => void
}

export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCollectionDialogProps) {
  const t = useTranslations("collections.deleteDialog")
  const [deleteCollection, { loading }] = useMutation<{
    deleteCollection: { success: boolean; message?: string | null }
  }>(DELETE_SHOP_COLLECTION, {
    refetchQueries: [
      { query: GET_SHOP_COLLECTIONS, variables: { page: 1, limit: 50 } },
    ],
    awaitRefetchQueries: true,
  })

  const name = collectionName(collection.name) || collection.slug
  const productCount = collection.product_count ?? 0

  const handleDelete = async () => {
    try {
      const res = await deleteCollection({ variables: { id: collection.id } })
      if (res.data?.deleteCollection?.success) {
        sileo.success({ title: t("deleted"), description: name })
        onOpenChange(false)
        onDeleted?.()
      } else {
        sileo.error({
          title: t("failed"),
          description: res.data?.deleteCollection?.message ?? t("serverRejected"),
        })
      }
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  const strong = (chunks: React.ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t.rich("body", { name, b: strong })}
          </DialogDescription>
        </DialogHeader>

        {productCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {t.rich("productsNote", { count: productCount, b: strong })}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm" disabled={loading}>
                {t("cancel")}
              </Button>
            }
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
