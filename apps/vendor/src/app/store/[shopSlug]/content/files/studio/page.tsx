import { AiStudioPage } from "@/features/files/components/ai-studio-page"

/**
 * AI Studio with no file in hand — `/store/:shopSlug/content/files/studio`.
 *
 * A static sibling of `[fileId]`, so Next.js matches it first and the file view
 * needs no exclusion for it. Nothing to preload: there is no subject yet, and
 * the rail's own `enhanceStyles` query takes no variables.
 */
export default function AiStudioRoute() {
  return <AiStudioPage />
}
