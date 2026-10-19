import { AdSpendManager } from "@/features/attribution"

export default async function AdSpendRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <AdSpendManager />
}
