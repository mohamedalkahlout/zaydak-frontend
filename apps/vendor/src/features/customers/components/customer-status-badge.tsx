"use client"

import { useTranslations } from "next-intl"

import type { ContactStatus } from "@/features/customers/types"
import { cn } from "@/shared/lib/utils"
import {
  CONTACT_STATUS_STYLE,
  contactStatusKey,
} from "@/features/customers/lib/constants"

/**
 * Only the tint is local. The word comes from the same message key the filter
 * menu offering that status reads, so a badge and the chip that filtered to it
 * cannot disagree.
 */
export function CustomerStatusBadge({ status }: { status: ContactStatus }) {
  const t = useTranslations("customers")
  const key = contactStatusKey(status)
  // A status the server invents renders as its raw id rather than a
  // missing-message path in a table cell.
  const label = t.has(key) ? t(key) : status

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CONTACT_STATUS_STYLE[status],
      )}
    >
      {label}
    </span>
  )
}
