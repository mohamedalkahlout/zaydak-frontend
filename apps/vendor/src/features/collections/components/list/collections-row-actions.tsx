"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { UPDATE_SHOP_COLLECTION } from "@/features/collections/api"
import type {
  ShopCollection,
  UpdateShopCollectionResult,
} from "@/features/collections/types"
import { collectionName } from "@/features/collections/lib/list/helpers"
import { DeleteCollectionDialog } from "./delete-collection-dialog"

interface CollectionsRowActionsProps {
  collection: ShopCollection
}

export function CollectionsRowActions({
  collection,
}: CollectionsRowActionsProps) {
  const t = useTranslations("collections")
  const params = useParams<{ shopSlug: string }>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Editing is a screen, not a dialog: a collection is its sources and the
  // items they select, and neither fits behind a four-field modal.
  const editHref = `/store/${params?.shopSlug ?? ""}/products/collections/${collection.id}`

  // Publishing is the one field worth changing without opening the editor —
  // it is a single boolean with no other state to stage, so the row writes it
  // straight away. Everything else stays behind the save bar on the screen.
  const [updateCollection, { loading: publishing }] =
    useMutation<UpdateShopCollectionResult>(UPDATE_SHOP_COLLECTION, {
      refetchQueries: "active",
    })

  const togglePublished = async () => {
    const next = !collection.is_published
    try {
      const { data } = await updateCollection({
        variables: { input: { id: collection.id, is_published: next } },
      })
      const payload = data?.updateCollection
      if (!payload?.success) {
        sileo.error({
          title: t("rowActions.updateFailed"),
          description: payload?.message ?? t("rowActions.serverRejected"),
        })
        return
      }
      sileo.success({
        title: next ? t("rowActions.published") : t("rowActions.hidden"),
        description: collectionName(collection.name) || collection.slug,
      })
    } catch (error) {
      sileo.error({
        title: t("rowActions.updateFailed"),
        description:
          error instanceof Error ? error.message : t("rowActions.tryAgain"),
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button
              {...p}
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("rowActions.label")}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={<Link href={editHref} />}
          >
            <PencilIcon className="mr-2 size-3.5 opacity-70" />
            {t("rowActions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={togglePublished} disabled={publishing}>
            {collection.is_published ? (
              <EyeOffIcon className="mr-2 size-3.5 opacity-70" />
            ) : (
              <EyeIcon className="mr-2 size-3.5 opacity-70" />
            )}
            {collection.is_published
              ? t("actions.unpublish")
              : t("actions.publish")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="mr-2 size-3.5 opacity-70" />
            {t("rowActions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
