import { ProductForm } from "@/features/products/components/form/product-form"
import { parseProductKindParam } from "@/features/products/lib/list/product-kind-meta"

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<{ kind?: string }>
}) {
  await params
  // `?kind=` is set by the "Add product" dialog. Anything unrecognised
  // (a hand-typed URL, a stale bookmark) falls back to a simple product.
  const { kind } = await searchParams
  return (
    <div className="lg:mx-12">
      <ProductForm initialKind={parseProductKindParam(kind)} />
    </div>
  )
}
