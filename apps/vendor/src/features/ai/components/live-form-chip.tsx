"use client"

import { useTranslations } from "next-intl"
import { EyeIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import {
  EDIT_TARGETS,
  type LiveFormTarget,
} from "@/features/ai/store-live-form"

interface Props {
  target: LiveFormTarget
  /** On an edit form: the product's saved title, the coupon's saved code. */
  label?: string
  className?: string
}

/**
 * "Editing: Linen Shirt" / "New coupon" — the form the assistant can see.
 *
 * While a product, coupon or collection form the assistant prepared is on
 * screen, every message carries its values and the assistant can change it
 * (the live form channel, `lib/live-form.ts`). Nothing in the chat said so:
 * "make it 300" worked beside one form and meant nothing beside another, and
 * the vendor had no way to tell which they were in front of. The chip sits in
 * the composer, with what else rides on the next message, for as long as that
 * is true.
 *
 * Presentational. `useLiveFormChip` decides whether there is a form to name;
 * this only words it. The name is the saved one, in a `<bdi>` so an English
 * title inside the Arabic sentence (or the reverse) keeps its own direction
 * and the chip truncates from its end in either.
 */
export function LiveFormChip({ target, label, className }: Props) {
  const t = useTranslations("aiChat.liveFormChip")
  const hint = t("hint")
  const editing = EDIT_TARGETS.has(target)

  return (
    <div
      role="status"
      title={hint}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <EyeIcon aria-hidden="true" className="size-3 shrink-0 text-violet-500" />
      <span className="min-w-0 truncate">
        {!editing
          ? t(`new.${target}`)
          : label
            ? t.rich("editing", {
                name: label,
                title: (chunks) => <bdi className="font-medium">{chunks}</bdi>,
              })
            : t(`editingUnnamed.${target}`)}
      </span>
      <span className="sr-only">{hint}</span>
    </div>
  )
}
