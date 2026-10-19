"use client"

import { useMemo } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GET_PRODUCT_BY_SLUG, GET_PRODUCT_COMPOSITION } from "@/features/products/api"
import type { ProductResponse } from "@/features/products/types"
import { ProductForm } from "../form/product-form"
import {
  productEntryToFormInput,
  snapshotsFromProduct,
} from "../../lib/form/from-product-entry"

export function EditProductView({ slug }: { slug: string }) {
  const t = useTranslations("products.editView")
  const { data } = useSuspenseQuery<ProductResponse>(GET_PRODUCT_BY_SLUG, {
    variables: { slug },
  })
  const product = data?.product?.data

  const { initialValues, snapshots } = useMemo(() => {
    if (!product) return { initialValues: undefined, snapshots: undefined }
    // `version` seeds `expected_version` so the optimistic-lock guard
    // (PRODUCTS.md §14.6) can reject lost updates.
    return {
      initialValues: productEntryToFormInput(product, product.version ?? undefined),
      snapshots: snapshotsFromProduct(product),
    }
  }, [product])

  if (!product) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("notFound")}
      </div>
    )
  }

  return (
    <EditProductForm
      productId={product.id}
      slug={product.slug}
      initialValues={initialValues}
      initialSnapshots={snapshots}
    />
  )
}

function EditProductForm({
  productId,
  slug,
  initialValues,
  initialSnapshots,
}: {
  productId: string
  slug: string
  initialValues: ReturnType<typeof productEntryToFormInput> | undefined
  initialSnapshots: ReturnType<typeof snapshotsFromProduct> | undefined
}) {
  const { data } = useSuspenseQuery(GET_PRODUCT_COMPOSITION, {
    variables: { product_id: productId },
  })
  const assembled = Boolean(data?.productComposition?.data)

  return (
    <ProductForm
      mode="edit"
      productId={productId}
      slug={slug}
      initialValues={initialValues}
      initialSnapshots={initialSnapshots}
      assembled={assembled}
    />
  )
}
