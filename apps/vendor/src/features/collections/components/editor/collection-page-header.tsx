"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"
import { useMutation } from "@apollo/client/react"
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react"
import { sileo } from "sileo"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { CREATE_SHOP_COLLECTION } from "@/features/collections/api"
import { formToInput } from "@/features/collections/lib/rules"
import type {
  CreateShopCollectionResult,
  ShopCollection,
} from "@/features/collections/types"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"
import { DeleteCollectionDialog } from "@/features/collections/components/list/delete-collection-dialog"
import { PUBLISHED_BADGE_STYLE } from "@/features/collections/lib/list/constants"
import { cn } from "@/shared/lib/utils"

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003"

/**
 * The editor's page header, shaped the way Shopify shapes a collection page:
 *
 *   tag / Edit collection  [Published]     [Duplicate] [View] [More actions]
 *
 * It is where the collection's own actions live, publishing included. The
 * details card used to carry an inline "Online store" switch beside the
 * title; a page-level state does not belong inside the card that describes
 * the collection, and the same state is reachable from the list table too.
 *
 * Publish stages into the form like every other control on this screen, so
 * the save bar stays the one commit point. Duplicate and Delete are immediate
 * instead: each is its own write, with nothing to stage.
 */
export function CollectionPageHeader({
  form,
  collection,
}: {
  form: CollectionFormApi
  collection?: ShopCollection
}) {
  const t = useTranslations("collections")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const backHref = `/store/${shopSlug}/products/collections`
  const [deleteOpen, setDeleteOpen] = useState(false)

  const published = useWatch({ control: form.control, name: "is_published" })

  // Nothing on the storefront routes by collection handle; its catalogue does
  // filter by collection id, so that is the page "View" lands on.
  const viewHref = collection
    ? `${STOREFRONT_URL}/${shopSlug}/products?collections=${collection.id}`
    : ""

  const [duplicateCollection, { loading: duplicating }] =
    useMutation<CreateShopCollectionResult>(CREATE_SHOP_COLLECTION, {
      refetchQueries: "active",
    })

  const handleDuplicate = async () => {
    if (!collection) return
    const values = form.getValues()
    const input = formToInput({
      ...values,
      name: {
        en: values.name.en?.trim()
          ? `${values.name.en.trim()} ${t("actions.copySuffix")}`
          : "",
        ar: values.name.ar?.trim()
          ? `${values.name.ar.trim()} ${t("actions.copySuffix")}`
          : "",
      },
      // Handles are unique per shop, so the copy carries none and lets the
      // API derive a free one from its new title.
      slug: "",
    })
    try {
      const { data } = await duplicateCollection({ variables: { input } })
      const payload = data?.createCollection
      if (!payload?.success) {
        sileo.error({
          title: t("actions.duplicateFailed"),
          description: payload?.message ?? t("fixTheForm"),
        })
        return
      }
      sileo.success({ title: t("actions.duplicated") })
      router.push(`${backHref}/${payload.data?.id ?? ""}`)
    } catch (error) {
      sileo.error({
        title: t("actions.duplicateFailed"),
        description: error instanceof Error ? error.message : t("fixTheForm"),
      })
    }
  }

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(viewHref).then(
      () => sileo.success({ title: t("actions.linkCopied") }),
      () => sileo.error({ title: t("actions.copyFailed") }),
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={t("backToList")}
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <TagsIcon className="size-4" />
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {collection ? t("editCollection") : t("addCollection")}
          </h1>
          <Badge
            className={cn(
              "h-6 rounded-md px-2.5",
              PUBLISHED_BADGE_STYLE[published ? "published" : "hidden"],
            )}
          >
            {published ? t("channel.published") : t("channel.hidden")}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={!collection || duplicating}
          >
            {duplicating ? t("actions.duplicating") : t("actions.duplicate")}
          </Button>

          {collection ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={viewHref} target="_blank" rel="noreferrer noopener" />
              }
            >
              {t("actions.view")}
              <ExternalLinkIcon className="ml-1.5 size-3.5 opacity-70" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              {t("actions.view")}
              <ExternalLinkIcon className="ml-1.5 size-3.5 opacity-70" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={(p) => (
                <Button {...p} type="button" variant="outline" size="sm">
                  {t("actions.more")}
                  <ChevronDownIcon className="ml-1 size-3.5" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  form.setValue("is_published", !published, {
                    shouldDirty: true,
                  })
                }
              >
                {published ? (
                  <EyeOffIcon className="mr-2 size-3.5 opacity-70" />
                ) : (
                  <EyeIcon className="mr-2 size-3.5 opacity-70" />
                )}
                {published ? t("actions.unpublish") : t("actions.publish")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} disabled={!collection}>
                <LinkIcon className="mr-2 size-3.5 opacity-70" />
                {t("actions.copyLink")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!collection}
              >
                <Trash2Icon className="mr-2 size-3.5 opacity-70" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {collection && (
        <DeleteCollectionDialog
          collection={collection}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push(backHref)}
        />
      )}
    </>
  )
}
