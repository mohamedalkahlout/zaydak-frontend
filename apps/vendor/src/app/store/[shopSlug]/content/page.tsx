import { redirect } from "next/navigation"

/** Content has no landing page yet — send it straight to Files. */
export default async function ContentPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  redirect(`/store/${shopSlug}/content/files`)
}
