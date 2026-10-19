import { notFound } from "next/navigation"

import { AssistantCard } from "@/features/integrations/components/assistant-card"
import { ShippingHealthCard } from "@/features/integrations/components/shipping-health-card"
import { IntegrationSettings } from "@/features/integrations/components/integration-settings"
import { slugToType } from "@/features/integrations/nav"

/**
 * One settings screen per integration type, addressed by slug
 * (`/integrations/email`). A URL rather than a tab: each integration is a form
 * with its own unsaved state, and "the email settings" is something an operator
 * links a colleague to.
 */
export default async function IntegrationTypePage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type: slug } = await params
  const type = slugToType(slug)
  // A slug the registry does not support 404s instead of rendering an empty
  // form, which would read as a broken integration rather than a typo.
  if (!type) notFound()

  return (
    <>
      <IntegrationSettings type={type} />
      {/* WhatsApp alone carries a second object: the assistant's own paired
          session. It renders below the credentials rather than inside them
          because it depends on them — there is nowhere to pair against until
          the Evolution server is configured — and because it is not a form.
          Every other type is one row and one Save. */}
      {type === "WHATSAPP" ? <AssistantCard /> : null}
      {/* Shipping carries the Operator Health Panel for testing OTO connection,
          National Address registry lookup, and callback configuration. */}
      {type === "SHIPPING" ? <ShippingHealthCard /> : null}
    </>
  )
}

