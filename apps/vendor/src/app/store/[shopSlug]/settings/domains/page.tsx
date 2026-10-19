import { DomainsPane } from "@/features/settings"

/**
 * Settings → Domains, at its own URL.
 *
 * A static sibling of `[section]`, which would otherwise render the "coming
 * soon" placeholder for this id.
 */
export default function SettingsDomainsPage() {
  return <DomainsPane />
}
