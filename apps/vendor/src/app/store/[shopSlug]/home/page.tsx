import { redirect } from "next/navigation"

/**
 * There is no `/home` screen. The dashboard lives at `/store/[shopSlug]`.
 * Keep this path so a typed or bookmarked `/home` lands there instead of 404.
 */
export default async function ShopHomeRedirectPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  redirect(`/store/${shopSlug}`)
}
