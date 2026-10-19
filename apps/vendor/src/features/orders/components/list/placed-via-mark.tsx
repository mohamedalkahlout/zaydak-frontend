"use client"

import { useTranslations } from "next-intl"
import { MessageCircle, Send } from "lucide-react"

/**
 * Marks an order the shop's assistant took in a chat.
 *
 * A mark beside the number rather than a column: it is true of a handful of
 * orders, and a column that is empty on almost every row is width the table
 * pays for nothing. It answers the question a merchant has on seeing an order
 * they do not remember — where did this come from — and nothing else, so an
 * order placed anywhere else carries no mark at all.
 */
export function PlacedViaMark({ placedVia }: { placedVia?: string | null }) {
  const t = useTranslations("orders.placedVia")
  const mark = placedVia ? MARKS[placedVia] : undefined
  if (!mark || !placedVia) return null
  const label = t(placedVia)
  const Icon = mark.icon
  return (
    <span
      className={`inline-flex size-5 items-center justify-center rounded-full ${mark.tone}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon className="size-3" aria-hidden />
    </span>
  )
}

/**
 * One mark per chat an assistant takes orders in, each in its app's colour.
 * An unknown value marks nothing rather than guessing at a channel.
 */
const MARKS: Record<string, { icon: typeof MessageCircle; tone: string }> = {
  whatsapp_assistant: {
    icon: MessageCircle,
    tone: "bg-emerald-100 text-emerald-800",
  },
  telegram_assistant: { icon: Send, tone: "bg-sky-100 text-sky-800" },
}
