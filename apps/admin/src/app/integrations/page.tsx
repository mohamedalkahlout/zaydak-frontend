import { redirect } from "next/navigation"

import { INTEGRATION_TYPES, integrationHref } from "@/features/integrations/nav"

/**
 * `/integrations` is a section, not a screen — every integration is configured
 * on its own page. Land on the first one rather than showing an index nobody
 * would read, since the sidebar already lists them.
 */
export default function IntegrationsPage() {
  redirect(integrationHref(INTEGRATION_TYPES[0]))
}
