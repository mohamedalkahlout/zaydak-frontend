import { TargetsPage } from "@/features/targets"

export default async function TargetsRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <TargetsPage />
}
