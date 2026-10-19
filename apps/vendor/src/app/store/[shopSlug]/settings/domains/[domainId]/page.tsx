import {
  DomainDetailPane,
  PlatformDomainPane,
} from "@/features/settings"
import { PLATFORM_DOMAIN_ID } from "@/features/settings/lib/routes"

/**
 * One address's page.
 *
 * Its own URL rather than a card under the table, because the instructions
 * belong to one domain and are the thing a merchant sends to whoever runs
 * their DNS. The id is the row's; the pane answers "no longer connected" for
 * one that is not this shop's, since the API scopes every read by `X-SHOP`.
 *
 * **One route, two panes**, split on a sentinel. The platform subdomain has no
 * `shop_domains` row and therefore no id, which is why it used to open nothing
 * at all; `PLATFORM_DOMAIN_ID` gives it an address without giving it a row.
 * The two screens are genuinely different rather than one with things hidden:
 * a custom domain's page is about DNS the merchant has to edit, and nobody
 * points `<slug>.<root>` anywhere — so every record table, readiness check and
 * Verify button on it would be an empty box.
 */
export default async function SettingsDomainPage({
  params,
}: {
  params: Promise<{ domainId: string }>
}) {
  const { domainId } = await params

  if (domainId === PLATFORM_DOMAIN_ID) return <PlatformDomainPane />
  return <DomainDetailPane domainId={domainId} />
}
