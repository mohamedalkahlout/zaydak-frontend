"use client"

import { useTranslations } from "next-intl"
import { NotificationsSettings } from "@/features/notifications"
import { PlanSettingsSection } from "@/features/plan/components/plan-settings-section"
import { ShippingSection } from "@/features/shipping"
import { WhatsAppSection } from "@/features/whatsapp"
import { TelegramSection } from "@/features/telegram"
import { InstagramSection } from "@/features/instagram"
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settings-sections"
import { SectionPlaceholder } from "./section-placeholder"
import { useSettingsShop } from "./settings-shell"

/**
 * Thin client wrappers so each built pane can be a one-line server page.
 *
 * The panes themselves live in their own features — Plan reads `myPlan`,
 * Shipping needs the shop's currency, Notifications owns its own queries. What
 * is here is only the glue that hands them what the settings route knows.
 */

export function ShippingPane() {
  const shop = useSettingsShop()
  return <ShippingSection currency={shop?.currency} />
}

export function PlanPane() {
  return <PlanSettingsSection />
}

export function WhatsAppPane() {
  return <WhatsAppSection />
}

export function TelegramPane() {
  return <TelegramSection />
}

export function InstagramPane() {
  return <InstagramSection />
}

export { PoliciesPane } from "./policies-pane"
export { TaxesPane } from "./taxes-pane"
export { AbandonedCartsPane } from "./abandoned-carts-pane"

export { NotificationsSettings }

/**
 * The sections that are named in the rail but not built.
 *
 * They are real URLs rather than a rail entry that does nothing: the rail is a
 * table of contents for the whole settings surface, and an entry that refuses
 * to navigate reads as broken rather than as unbuilt.
 */
export function SectionPlaceholderPane({ id }: { id: SettingsSectionId }) {
  const tNav = useTranslations("settings.nav")
  const section = SETTINGS_SECTIONS.find((s) => s.id === id)
  if (!section) return null
  return <SectionPlaceholder icon={section.icon} title={tNav(id)} />
}
