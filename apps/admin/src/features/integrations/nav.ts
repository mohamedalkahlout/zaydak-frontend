import type { LucideIcon } from "lucide-react"
import {
  BrainIcon,
  BugIcon,
  CameraIcon,
  HardDriveIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  SendIcon,
  SparklesIcon,
  StoreIcon,
  TruckIcon,
} from "lucide-react"

import type { IntegrationType } from "@/shared/api/generated/graphql"

/**
 * The integration types that get their own settings screen, in rail order.
 *
 * This mirrors `SUPPORTED_TYPES` in `back-end/src/integrations/provider-registry.ts`
 * — the Prisma enum also declares `PAYMENT`, which has no provider spec yet, so
 * offering it would open a form with nothing to pick.
 *
 * `STORAGE` holds the Bunny credentials uploads are written with — never the
 * choice of storage driver, which stays `STORAGE_DRIVER` in the server
 * environment.
 *
 * **Types are listed here; providers never are.** A new provider (another SMS
 * gateway, another mail service) appears on its type's screen with no change in
 * this app, because the form is built from `integrationProviders`. A new *type*
 * costs one line here plus an icon — rare enough to be worth the explicitness,
 * since each one also needs a nav label and a place in the order.
 *
 * The app sidebar carries a single **Integrations** entry; this list is rendered
 * by the page's own left rail (`IntegrationRail`), the same shape the vendor
 * dashboard's settings overlay uses. One list, in one place.
 */
export const INTEGRATION_TYPES = [
  "SMS",
  "EMAIL",
  "MONITORING",
  "AI_CHAT",
  "AI_MEDIA",
  "WHATSAPP",
  "TELEGRAM",
  "INSTAGRAM",
  "SHIPPING",
  "SCRAPING",
  "STORAGE",
] as const

export type SupportedIntegrationType = (typeof INTEGRATION_TYPES)[number]

/** One icon per type, keyed on the API enum rather than on a slug. */
export const INTEGRATION_ICONS: Record<string, LucideIcon> = {
  SMS: MessageSquareIcon,
  EMAIL: MailIcon,
  MONITORING: BugIcon,
  AI_CHAT: BrainIcon,
  AI_MEDIA: SparklesIcon,
  WHATSAPP: MessageCircleIcon,
  TELEGRAM: SendIcon,
  INSTAGRAM: CameraIcon,
  SHIPPING: TruckIcon,
  SCRAPING: StoreIcon,
  STORAGE: HardDriveIcon,
}

/** `EMAIL` -> `email`. The enum is the API's vocabulary; the URL uses lowercase. */
export function typeToSlug(type: string): string {
  return type.toLowerCase()
}

/**
 * `email` -> `EMAIL`, or null for anything not supported.
 *
 * Returns null rather than guessing: the slug comes from the address bar, and a
 * typo has to render "not found" instead of an empty settings form that looks
 * like a broken integration.
 */
export function slugToType(slug: string): IntegrationType | null {
  const upper = slug.toUpperCase()
  return (INTEGRATION_TYPES as readonly string[]).includes(upper)
    ? (upper as IntegrationType)
    : null
}

export function integrationHref(type: string): string {
  return `/integrations/${typeToSlug(type)}`
}
