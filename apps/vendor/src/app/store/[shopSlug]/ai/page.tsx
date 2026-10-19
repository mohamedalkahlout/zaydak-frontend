import { VendorAgentChat } from "@/features/ai/components/vendor-agent-chat"

export default async function VendorAgentPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <div className="p-4 md:p-6">
      <VendorAgentChat />
    </div>
  )
}
