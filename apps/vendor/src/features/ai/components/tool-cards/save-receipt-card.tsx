"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react"
import type { SaveReceiptResult } from "@/features/ai/lib/types"

interface Props {
  result: SaveReceiptResult
}

/**
 * The receipt for a save the assistant set up.
 *
 * Quiet on purpose — a thin confirmation row rather than a `ResultCardShell`
 * like the data cards. Nothing here is a result the vendor has to read: they
 * just pressed Save and watched it work, so the row's whole job is to put the
 * outcome in the conversation, where the next thing they say can refer to it.
 *
 * The sentence itself is the turn's `content`, written by the server and
 * rendered as ordinary prose above this. What the card adds is the way back
 * to the record, which prose cannot carry: the work-log renderer drops links
 * from assistant text entirely, deliberately, so an assistant-authored href
 * can never become a phishing surface.
 */
export function SaveReceiptCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.saveReceipt")
  const receipt = result.save_receipt
  if (!receipt?.url) return null

  return (
    <Link
      href={receipt.url}
      className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs transition hover:bg-muted"
    >
      <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="truncate font-medium" dir="auto">
        {receipt.name}
      </span>
      <span className="text-muted-foreground">
        {t("open", { entity: receipt.entity })}
      </span>
      <ArrowRightIcon className="size-3.5 shrink-0 rtl:rotate-180" />
    </Link>
  )
}
