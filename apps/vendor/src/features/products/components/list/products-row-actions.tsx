"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { EyeIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import type { Product } from "@/features/products/types"
import { productName } from "@/features/products/lib/list/helpers"

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003"

/**
 * Row-level action: preview, and nothing else.
 *
 * The status flips used to live here in an overflow menu — Publish, Unpublish
 * and Archive, each shown or hidden by where the six-state machine said the
 * product could go next. Status is now edited from its own cell, which is one
 * click instead of three and shows what each choice means.
 *
 * The menu itself is gone too. What it held was Edit and Duplicate, and
 * neither needed it: the product name in the row is already a link to the
 * editor, and Duplicate lives on the product page's own header, where the
 * thing being cloned is on screen. A menu whose every item had a better
 * entrypoint elsewhere was one click in front of two links.
 *
 * Preview is what stays, as its own eye button — the one action here that is
 * not an edit: it opens the product's storefront page in a new tab, which is
 * the question a vendor scanning the list actually asks of a row.
 */
export function ProductsRowActions({ product }: { product: Product }) {
  const t = useTranslations("products.rowActions")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const previewHref = `${STOREFRONT_URL}/${shopSlug}/products/${product.slug}`

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={t("preview", { name: productName(product.name) })}
        render={
          <a href={previewHref} target="_blank" rel="noreferrer noopener" />
        }
      >
        <EyeIcon className="size-4" />
      </Button>
    </div>
  )
}
