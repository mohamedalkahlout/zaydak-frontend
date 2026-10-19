import type { LucideIcon } from "lucide-react"
import type { IconType } from "react-icons"
import { FaInstagram } from "react-icons/fa6"
import {
  Activity,
  Bell,
  Blocks,
  CreditCard,
  Database,
  FileText,
  Globe,
  Languages,
  Layers,
  Link2,
  Mail,
  MessageCircle,
  MapPin,
  Network,
  Percent,
  Receipt,
  Send,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  Users,
} from "lucide-react"

/**
 * Left-rail entries for the settings overlay. Built sections have dedicated
 * routes; every other id renders the shared "coming soon" placeholder. `key`
 * is the i18n key under the `settings.nav` namespace.
 */
export type SettingsSectionId =
  | "general"
  | "plan"
  | "billing"
  | "users"
  | "payments"
  | "checkout"
  | "abandonedCarts"
  | "customerAccounts"
  | "shipping"
  | "taxes"
  | "locations"
  | "markets"
  | "apps"
  | "salesChannels"
  | "whatsapp"
  | "telegram"
  | "instagram"
  | "shein"
  | "domains"
  | "customerEvents"
  | "notifications"
  | "metafields"
  | "languages"
  | "customerPrivacy"
  | "policies"

export interface SettingsSection {
  id: SettingsSectionId
  icon: LucideIcon | IconType
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "general", icon: Store },
  { id: "plan", icon: Layers },
  { id: "billing", icon: Receipt },
  { id: "users", icon: Users },
  { id: "payments", icon: CreditCard },
  { id: "checkout", icon: ShoppingCart },
  { id: "abandonedCarts", icon: Mail },
  { id: "customerAccounts", icon: UserRound },
  { id: "shipping", icon: Truck },
  { id: "taxes", icon: Percent },
  { id: "locations", icon: MapPin },
  { id: "markets", icon: Globe },
  { id: "apps", icon: Blocks },
  { id: "salesChannels", icon: Network },
  { id: "whatsapp", icon: MessageCircle },
  { id: "telegram", icon: Send },
  { id: "instagram", icon: FaInstagram },
  { id: "shein", icon: ShoppingBag },
  { id: "domains", icon: Link2 },
  { id: "customerEvents", icon: Activity },
  { id: "notifications", icon: Bell },
  { id: "metafields", icon: Database },
  { id: "languages", icon: Languages },
  { id: "customerPrivacy", icon: ShieldCheck },
  { id: "policies", icon: FileText },
]
