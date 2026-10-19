"use client"

import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  mentionCategory,
  mentionKey,
  type MentionCandidate,
} from "@/features/ai/lib/mention-config"

interface Props {
  mentions: MentionCandidate[]
  onRemove: (key: string) => void
}

/**
 * The picked @-mention chips shown inside the composer, above the textarea.
 * Removable, deduped by `type:id`. Shared by both composers.
 */
export function MentionChips({ mentions, onRemove }: Props) {
  const t = useTranslations("aiChat.composer")
  if (mentions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {mentions.map((m) => {
        const def = mentionCategory(m.type)
        return (
          <span
            key={mentionKey(m)}
            className="inline-flex items-center gap-1 max-w-45 rounded-full border bg-muted/60 ps-2 pe-1 py-0.5 text-[11px]">
            <def.Icon className={cn("size-3 shrink-0", def.color)} />
            <span className="truncate">{m.display}</span>
            <button
              type="button"
              onClick={() => onRemove(mentionKey(m))}
              aria-label={t("remove")}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition">
              <XIcon className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
