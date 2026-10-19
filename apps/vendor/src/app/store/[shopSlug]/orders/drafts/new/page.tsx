import { DraftOrderForm } from "@/features/orders/components/drafts/draft-order-form"

export default async function NewDraftOrderPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params
  return <DraftOrderForm mode="create" />
}
