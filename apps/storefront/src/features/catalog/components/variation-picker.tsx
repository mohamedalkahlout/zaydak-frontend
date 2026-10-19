"use client"

import { useLocale, useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import { text } from "@/shared/lib/multilang"
import type { ProductDetail, OptionSelection, Variation } from "../lib/variations"
import { isColorOption, swatchColor, swatchNeedsBorder } from "../lib/colors"
import { reachableValues } from "../lib/variations"

/**
 * The size/colour picker.
 *
 * Values that no remaining variation can reach are rendered *disabled rather
 * than hidden*. Hiding them makes the list silently change length as choices
 * are made, which reads as a glitch; showing them struck through answers the
 * shopper's real question — "does this shop make a red XL at all?" — without
 * them having to try it.
 *
 * A colour option renders as swatches and everything else as chips, decided by
 * `isColorOption`: the option has to be *named* a colour and every one of its
 * values has to resolve to a hex, so a picker is never half circles and half
 * words. See `lib/colors.ts` for why that bar is set where it is.
 *
 * Options sit side by side from `sm` up when there is more than one, which is
 * what keeps colour and size on one line instead of pushing the buy controls a
 * screen further down.
 */
export function VariationPicker({
  definitions,
  variations,
  selection,
  onSelect,
}: {
  definitions: NonNullable<ProductDetail["option_definitions"]>
  variations: readonly Variation[]
  selection: OptionSelection
  onSelect: (optionName: string, value: string) => void
}) {
  const locale = useLocale()
  const t = useTranslations("product")

  const ordered = [...definitions].sort((a, b) => a.position - b.position)

  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-6",
        ordered.length > 1 && "sm:grid-cols-2",
      )}
    >
      {ordered.map((definition) => {
        const name = text(definition.name, locale)
        if (!name) return null

        const reachable = reachableValues(variations, name, selection)
        const chosen = selection[name.toLowerCase()]

        const labels = definition.values
          .map((option) => text(option.label, locale))
          .filter(Boolean)
        const asSwatches = isColorOption(name, labels)

        return (
          <fieldset key={name} aria-label={t("chooseOption", { option: name })}>
            <legend className="mb-3 font-mono text-[0.6875rem] font-medium tracking-widest text-shop-accent uppercase">
              {name}
            </legend>
            <div className={cn("flex flex-wrap", asSwatches ? "gap-4" : "gap-2")}>
              {labels.map((label) => {
                const available = reachable.has(label.toLowerCase())
                const isChosen = chosen === label.toLowerCase()
                // `key` is passed at each call site rather than through here:
                // React warns when a props object containing one is spread.
                const shared = {
                  type: "button" as const,
                  disabled: !available,
                  "aria-pressed": isChosen,
                  onClick: () => onSelect(name, label),
                  title: available ? undefined : t("optionUnavailable"),
                }

                if (asSwatches) {
                  const hex = swatchColor(label) as string
                  return (
                    <button
                      key={label}
                      {...shared}
                      className={cn(
                        "flex w-14 flex-col items-center gap-2 rounded-lg py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        !available && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <span
                        aria-hidden
                        style={{ backgroundColor: hex }}
                        className={cn(
                          "size-8 rounded-full transition-shadow",
                          swatchNeedsBorder(hex) && "ring-1 ring-shop-hairline",
                          isChosen &&
                            "ring-2 ring-shop-accent ring-offset-2 ring-offset-card",
                        )}
                      />
                      <span
                        className={cn(
                          "text-center text-xs leading-tight",
                          isChosen ? "font-medium" : "text-muted-foreground",
                          !available && "line-through",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  )
                }

                return (
                  <button
                    key={label}
                    {...shared}
                    className={cn(
                      "min-w-11 rounded-lg px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      isChosen
                        ? "bg-shop-accent text-shop-accent-foreground"
                        : "bg-card ring-1 ring-shop-hairline hover:ring-shop-accent",
                      !available &&
                        "cursor-not-allowed text-muted-foreground line-through opacity-60 hover:ring-shop-hairline",
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
