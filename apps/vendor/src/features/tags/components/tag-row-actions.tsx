"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { EllipsisIcon } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { DELETE_TAG } from "@/features/tags/api"
import { GET_TAGS } from "@/features/tags/api"
import type { DeleteTagResponse, Tag } from "@/features/tags/types"
import { translatable } from "@/shared/lib/format"
import { TagFormDialog } from "./tag-form-dialog"

export function TagRowActions({ tag }: { tag: Tag }) {
  const t = useTranslations("tags.rowActions")
  const tCommon = useTranslations("common")
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [deleteTag, { loading: deleting }] = useMutation<DeleteTagResponse>(
    DELETE_TAG,
    {
      refetchQueries: [{ query: GET_TAGS, variables: { page: 1, limit: 100 } }],
      awaitRefetchQueries: true,
    },
  )

  const handleDelete = async () => {
    try {
      const res = await deleteTag({ variables: { id: tag.id } })
      if (res.data?.deleteTag?.success) {
        sileo.success({
          title: t("deleted"),
          description: translatable(tag.name),
        })
        setDeleteOpen(false)
      } else {
        sileo.error({ title: t("deleteFailed") })
      }
    } catch (err) {
      sileo.error({
        title: t("deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
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
              aria-label={t("label")}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            {tCommon("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TagFormDialog
        tag={tag}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteBody", { name: translatable(tag.name) || tag.slug })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" size="sm" disabled={deleting}>
                  {tCommon("cancel")}
                </Button>
              }
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t("deleting") : tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
