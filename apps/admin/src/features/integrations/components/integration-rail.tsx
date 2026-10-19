"use client"

import { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { BlocksIcon } from "lucide-react"

import { SettingsRail } from "@repo/ui/components/settings-rail"

import {
  INTEGRATION_ICONS,
  INTEGRATION_TYPES,
  integrationHref,
} from "../nav"

/**
 * The left rail of the integrations screen — the shared `SettingsRail` card
 * (`@repo/ui`), the same one the vendor dashboard's settings overlay draws,
 * filled with the integration types.
 *
 * **Links, not local state.** The rail itself decides nothing about
 * navigation; every entry here is a `Link` because each integration is already
 * its own route, and the active one is derived from the path. That keeps what
 * the URL bought — a linkable "the email settings", a back button that works,
 * and one form's unsaved state per route rather than three half-filled forms
 * sharing one.
 *
 * Rendered by `app/integrations/layout.tsx`, so it survives navigation between
 * types instead of remounting (and losing the filter) on every click.
 */
export function IntegrationRail() {
  const t = useTranslations("integrations")
  const pathname = usePathname()

  const items = useMemo(
    () =>
      INTEGRATION_TYPES.map((type) => ({
        id: type,
        label: t(`type.${type}`),
        icon: INTEGRATION_ICONS[type] ?? BlocksIcon,
        active: pathname === integrationHref(type),
      })),
    [pathname, t],
  )

  return (
    <SettingsRail
      title={t("railTitle")}
      subtitle={t("railSubtitle")}
      badge={<BlocksIcon className="size-4.5" />}
      items={items}
      renderItem={(item, props) => (
        <Link href={integrationHref(item.id)} {...props} />
      )}
      searchPlaceholder={t("searchNav")}
      emptyLabel={t("noNavMatch")}
    />
  )
}
