import { redirect } from "next/navigation"

/**
 * The standalone bank-transfers queue was removed — review happens on the
 * order detail page. Keep this path so old bookmarks and sidebar links land
 * on the orders list instead of a 404.
 */
export default async function BankTransfersRedirectPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  redirect(`/store/${shopSlug}/orders`)
}
