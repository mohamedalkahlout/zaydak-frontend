"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { useFormState, useWatch } from "react-hook-form"
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ExternalLinkIcon,
  StarIcon,
  TagIcon,
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
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { DUPLICATE_PRODUCT } from "@/features/products/api"
import type { ProductFormApi } from "@/features/products/validations/product"
import { STATUS_STYLE } from "@/features/products/lib/list/constants"
import { productName } from "@/features/products/lib/list/helpers"
import { shareTargets } from "@/features/products/lib/share-targets"
import { cn } from "@/shared/lib/utils"
import { useProductNeighbors } from "./use-product-neighbors"
import { DeleteProductDialog } from "./delete-product-dialog"
import { DuplicateProductDialog } from "./duplicate-product-dialog"

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003"

interface DuplicateData {
  duplicateProduct: {
    success: boolean
    data?: { id: string; slug: string } | null
  }
}

/**
 * The edit screen's page header, shaped the way Shopify shapes a product page:
 *
 *   tag / Example Perfume  [Active]     [Preview] [Share] [More actions] [up/down]
 *
 * It replaces a back arrow and the words "Edit product" — a title that named
 * the screen rather than the thing on it, on the one screen where the vendor
 * already knows which screen they are on and not always which product.
 *
 * Where each action commits follows the collection editor's split, for the
 * same reason: anything that edits *this* product stages into the form so the
 * save bar stays the one commit point, and anything that is its own write
 * (duplicate, delete) fires immediately. So "Set as draft" only moves the
 * Status card and still goes through Save, while Duplicate navigates to the
 * copy it just wrote.
 *
 * Duplicate has one exception to "fires immediately": while the form is
 * dirty it asks first (`DuplicateProductDialog`). The copy is made from the
 * saved row, not the form, and the navigation that follows discards the
 * edits — two losses at once, neither visible until later. A clean form
 * still duplicates in one click.
 *
 * Share is a popover rather than a bare copy-to-clipboard, because for an
 * UNLISTED product — one that "sells by direct link" — the link *is* the
 * status's whole purpose, and the vendor should see the handle they are about
 * to send. It shows the storefront URL with Copy beside it, then the share
 * targets from `shareTargets()`; a DRAFT gets a line saying the link goes
 * nowhere yet, with Copy left enabled for the vendor who wants it ready.
 *
 * "Set as draft" is where Shopify puts "Archive". We have no archived state —
 * three statuses, of which DRAFT already means hidden everywhere — so the slot
 * keeps the icon and the position and uses the word this app actually stores.
 */
export function ProductPageHeader({
  form,
  productId,
  slug,
}: {
  form: ProductFormApi
  productId: string
  slug: string
}) {
  const t = useTranslations("products.header")
  const tStatus = useTranslations("products.status")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const shopSlug = params?.shopSlug ?? ""
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false)
  const [, startTransition] = useTransition()

  // The same value-based dirty flag that drives the save bar
  // (`ProductFormLayout`), so Duplicate asks exactly when the bar is showing
  // and never when a field was typed back to its saved value.
  const { isDirty } = useFormState({ control: form.control })

  // The list's own query string, carried in by the row link. Kept on every
  // href out of here, so Back and the arrows land on the page, filters and
  // sort the vendor left rather than resetting them to page 1.
  const listQuery = searchParams.toString()
  const listHref = `/store/${shopSlug}/products${listQuery ? `?${listQuery}` : ""}`

  // `useWatch` widens both to `| undefined`; the form seeds each from
  // `productFormDefaults`, so the fallbacks are only there for the types.
  const name = useWatch({ control: form.control, name: "name" })
  const status = useWatch({ control: form.control, name: "status" }) ?? "DRAFT"
  const title = productName(name ?? null) || t("untitled")

  const viewHref = `${STOREFRONT_URL}/${shopSlug}/products/${slug}`
  const neighbors = useProductNeighbors(slug)

  const neighborHref = (neighbor: { slug: string; page: number }) => {
    const next = new URLSearchParams(listQuery)
    next.set("page", String(neighbor.page))
    return `/store/${shopSlug}/products/${neighbor.slug}/edit?${next.toString()}`
  }

  const [duplicate, { loading: duplicating }] = useMutation<DuplicateData>(
    DUPLICATE_PRODUCT,
    { refetchQueries: "active" },
  )

  /** Resolves `true` once the copy exists and we are leaving for it. */
  const handleDuplicate = async (): Promise<boolean> => {
    try {
      const { data } = await duplicate({ variables: { id: productId } })
      const cloned = data?.duplicateProduct?.data
      if (!cloned) {
        sileo.error({ title: t("duplicateFailed") })
        return false
      }
      sileo.success({ title: t("duplicated"), description: cloned.slug })
      startTransition(() =>
        router.push(`/store/${shopSlug}/products/${cloned.slug}/edit`),
      )
      return true
    } catch (err) {
      sileo.error({
        title: t("duplicateFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
      return false
    }
  }

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(viewHref).then(
      () => sileo.success({ title: t("linkCopied"), description: viewHref }),
      () => sileo.error({ title: t("copyFailed") }),
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
            render={<Link href={listHref} />}
          >
            <TagIcon className="size-4" />
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
          <Badge className={cn("h-6 rounded-md px-2.5", STATUS_STYLE[status])}>
            {tStatus(status)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={viewHref} target="_blank" rel="noreferrer noopener" />
            }
          >
            {t("preview")}
            <ExternalLinkIcon className="ms-1.5 size-3.5 opacity-70" />
          </Button>

          <Popover>
            <PopoverTrigger
              render={(p) => (
                <Button {...p} type="button" variant="outline" size="sm">
                  {t("share")}
                </Button>
              )}
            />
            <PopoverContent align="end" className="w-80">
              <PopoverHeader>
                <PopoverTitle>{t("shareTitle")}</PopoverTitle>
                {status === "DRAFT" && (
                  <PopoverDescription>{t("draftNotice")}</PopoverDescription>
                )}
              </PopoverHeader>
              <div className="flex items-center gap-1.5">
                {/* Read-only and select-all on focus: a URL that cannot be
                    edited but can be swept into a paste, for the vendor
                    whose clipboard permission is denied. */}
                <Input
                  readOnly
                  value={viewHref}
                  aria-label={t("productLink")}
                  className="text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleCopyLink}
                >
                  <CopyIcon className="me-1.5 size-3.5 opacity-70" />
                  {t("copyLink")}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {shareTargets(title, viewHref).map((target) => (
                  <Button
                    key={target.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a
                        href={target.href}
                        target={target.newTab ? "_blank" : undefined}
                        rel="noreferrer noopener"
                      />
                    }
                  >
                    {t(`shareTargets.${target.id}`)}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={(p) => (
                <Button {...p} type="button" variant="outline" size="sm">
                  {t("more")}
                  <ChevronDownIcon className="ms-1 size-3.5" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  if (isDirty) setDuplicateConfirmOpen(true)
                  else void handleDuplicate()
                }}
                disabled={duplicating}
              >
                <CopyIcon className="me-2 size-3.5 opacity-70" />
                {duplicating ? t("duplicating") : t("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={status === "DRAFT"}
                onClick={() =>
                  form.setValue("status", "DRAFT", { shouldDirty: true })
                }
              >
                <ArchiveIcon className="me-2 size-3.5 opacity-70" />
                {t("setAsDraft")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link href={`/store/${shopSlug}/reviews?product=${productId}`} />
                }
              >
                <StarIcon className="me-2 size-3.5 opacity-70" />
                {t("viewReviews")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="me-2 size-3.5 opacity-70" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Step through the list the vendor arrived from. Disabled rather
              than hidden at either end, so the pair never changes width. */}
          <div className="flex items-center gap-1">
            <ProductStepButton
              href={
                neighbors.previous ? neighborHref(neighbors.previous) : undefined
              }
              label={t("previous")}
              name={neighbors.previous?.name}
              icon={<ChevronUpIcon className="size-4" />}
            />
            <ProductStepButton
              href={neighbors.next ? neighborHref(neighbors.next) : undefined}
              label={t("next")}
              name={neighbors.next?.name}
              icon={<ChevronDownIcon className="size-4" />}
            />
          </div>
        </div>
      </div>

      <DeleteProductDialog
        productId={productId}
        name={title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push(listHref)}
      />
      <DuplicateProductDialog
        name={title}
        open={duplicateConfirmOpen}
        onOpenChange={setDuplicateConfirmOpen}
        loading={duplicating}
        onConfirm={handleDuplicate}
      />
    </>
  )
}

/**
 * One arrow. It has to be two different elements — a `Link` when there is
 * somewhere to go and a real `<button disabled>` when there is not — because
 * an anchor cannot be disabled: `aria-disabled` alone still navigates on
 * click and still takes focus.
 */
function ProductStepButton({
  href,
  label,
  name,
  icon,
}: {
  href?: string
  label: string
  name?: string
  icon: React.ReactNode
}) {
  const t = useTranslations("products.header")
  const aria = name ? t("stepTo", { label, name }) : label

  if (!href) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label={aria}
        disabled
      >
        {icon}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8"
      aria-label={aria}
      title={name}
      nativeButton={false}
      render={<Link href={href} />}
    >
      {icon}
    </Button>
  )
}
