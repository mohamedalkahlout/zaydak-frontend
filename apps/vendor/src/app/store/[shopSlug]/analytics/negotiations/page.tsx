import { NegotiationOutcomesPage } from "@/features/negotiation/components/negotiation-outcomes-page"

export default async function NegotiationOutcomesRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <NegotiationOutcomesPage />
}
