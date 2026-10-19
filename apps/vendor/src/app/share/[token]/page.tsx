import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { SharedConversationView } from "@/features/ai/components/shared-conversation-view"

/**
 * Public read-only view of a vendor-agent conversation. Reachable via
 * the URL the vendor copies from the /ai sidebar. No auth — the token
 * is the credential. Server component just extracts the token and
 * hands off to the client view (the GraphQL query is public, so it
 * runs from the browser like any other).
 */
export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <SharedConversationView token={token} />
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.sharedConversation")
  return { title: t("title"), description: t("description") }
}
