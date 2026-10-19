import {
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
  RotateCcwIcon,
  UserPlusIcon,
  MailIcon,
  type LucideIcon,
} from "lucide-react"
import type { NotifyCategory } from "../types"

/** Category display order, matching Shopify's Customer notifications groups. */
export const CATEGORY_ORDER: NotifyCategory[] = [
  "order_processing",
  "order_exceptions",
  "shipping_updates",
  "returns",
  "accounts",
]

const CATEGORY_ICON: Record<string, LucideIcon> = {
  order_processing: PackageIcon,
  order_exceptions: ReceiptIcon,
  shipping_updates: TruckIcon,
  returns: RotateCcwIcon,
  accounts: UserPlusIcon,
}

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICON[category] ?? MailIcon
}
