"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { m } from "motion/react"
import { Check } from "lucide-react"

import { text } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import type { AssistantAddition } from "../types"

/**
 * The receipt for something the assistant put in the cart.
 *
 * **A card, not a sentence, because it is a state change rather than an
 * answer.** The model already says what it added in prose; this is the part a
 * shopper scans for — did it work, what was it, and where is the cart — and
 * putting it in a bordered block with a link is the difference between
 * believing the assistant and going to check.
 *
 * Rendered from `additions`, which the cart tool records on a **successful**
 * write. A refused add produces no card, so this can never claim something
 * landed that did not.
 */
export function AssistantAdded({
  additions,
}: {
  additions: AssistantAddition[]
}) {
  const t = useTranslations("assistant")
  const locale = useLocale()
  const { base } = useShop()

  if (additions.length === 0) return null

  return (
    <m.div
 className="rounded-2xl border border-emerald-600/20 bg-emerald-50/60 p-3"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-2">
 <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          {/* The tick lands a beat after the card, which is what makes it read
              as confirmation rather than as decoration that was always there. */}
          <m.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 600, damping: 20 }}
            className="grid size-4 place-items-center rounded-full bg-emerald-600 text-white"
          >
            <Check className="size-2.5" aria-hidden strokeWidth={3} />
          </m.span>
          {t("added")}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`${base}/cart`}
            className="text-xs font-medium text-shop-accent hover:underline"
          >
            {t("viewCart")}
          </Link>
          <span className="text-xs text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link
            href={`${base}/checkout`}
            className="inline-flex items-center rounded bg-shop-accent px-2 py-0.5 text-xs font-medium text-shop-accent-foreground transition-opacity hover:opacity-90"
          >
            {t("checkout")}
          </Link>
        </div>
      </div>

      <ul className="mt-2 space-y-1">
        {additions.map((item) => (
          <li
            key={item.product_id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="line-clamp-1">
              {text(item.name, locale, "")}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              ×{item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </m.div>
  )
}
