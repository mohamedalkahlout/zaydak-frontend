"use client"

import { useTranslations } from "next-intl"
import { SparklesIcon } from "lucide-react"
import { useAiFilled } from "@/features/ai/components/ai-prefill-context"

/**
 * "The assistant filled this in."
 *
 * A chip **with words**, not a tint. The obvious build is to wash the input's
 * background in an accent at 5-10%, and on this palette that is a ~2%
 * perceptual shift on white: too faint to name, which is the worst state a
 * coloured field can be in — the vendor half-notices it and wonders whether
 * the field is locked or whether they broke something. The same control also
 * already speaks four other colour languages (the translation rail's
 * blue/emerald on exactly the fields the assistant fills most, `aria-invalid`
 * red, the outdated badge's amber, the focus ring), and a fifth with no word
 * attached is not a signal, it is noise.
 *
 * It renders nothing on a form the vendor opened themselves, and nothing once
 * they have typed in the field — see `ai-prefill-context`.
 *
 * Deliberately outside `FieldLabel`'s text: joining the accessible name gives
 * «السعر من المساعد», which Arabic reads as a genitive ("the assistant's
 * price") rather than as the parenthetical it is meant to be. It is its own
 * element with its own standalone phrase.
 */
export function AiFilledMark({ name }: { name: string }) {
  const filled = useAiFilled(name)
  const t = useTranslations("aiChat.filledMark")
  if (!filled) return null

  const label = t("label")

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300"
      title={label}
    >
      <SparklesIcon className="size-2.5" aria-hidden="true" />
      {label}
    </span>
  )
}
