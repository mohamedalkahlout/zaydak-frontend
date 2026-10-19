"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangleIcon, MoreHorizontalIcon, PaletteIcon } from "lucide-react"
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"
import { BrandAddButton, BrandRow, BrandTile } from "./brand-row"
import { AA_CONTRAST, contrastRatio, normalizeHex } from "../lib/contrast"

/**
 * One colour role — the fill and the text on it — as a slot that is empty until
 * a colour is chosen.
 *
 * Shopify calls these Primary and Secondary and shows a single "Add a primary
 * color" row. Keeping both halves of the pair in the one control is ours: the
 * pair is the only thing that can be checked for contrast, and this pane is the
 * only screen where the two are ever on top of each other. The warning is
 * advisory — a vendor is allowed to ship a low-contrast brand, they just should
 * not do it by accident.
 *
 * The editor is a popover rather than two swatches sitting in the card, because
 * the collapsed row is the whole point of the redesign: eight slots on one
 * screen only stay readable while an unset one costs a single line.
 */
export function BrandColorField({
  title,
  addLabel,
  background,
  foreground,
  onBackgroundChange,
  onForegroundChange,
}: {
  /** Shown once the pair holds a colour. */
  title: string
  /** Shown while it is empty — "Add a primary color". */
  addLabel: string
  background: string
  foreground: string
  onBackgroundChange: (hex: string) => void
  onForegroundChange: (hex: string) => void
}) {
  const t = useTranslations("settings.brand")
  const tCommon = useTranslations("common")

  const bg = normalizeHex(background)
  const fg = normalizeHex(foreground)
  const filled = !!(background.trim() || foreground.trim())
  const ratio = contrastRatio(background, foreground)
  const low = ratio !== null && ratio < AA_CONTRAST

  const clear = () => {
    onBackgroundChange("")
    onForegroundChange("")
  }

  return (
    <BrandRow
      tile={
        <BrandTile filled={filled}>
          {filled ? (
            /* `aria-hidden` — the hex codes beside it say the same thing in
               characters, and "Aa" read aloud is noise. */
            <span
              aria-hidden
              className="flex size-full items-center justify-center text-sm font-semibold"
              style={{
                backgroundColor: bg ?? "transparent",
                color: fg ?? "inherit",
              }}
            >
              Aa
            </span>
          ) : (
            <PaletteIcon className="size-4" />
          )}
        </BrandTile>
      }
      title={
        filled ? (
          <span className="font-mono text-sm uppercase" dir="ltr">
            {[bg ?? background, fg ?? foreground].filter(Boolean).join("  ·  ")}
          </span>
        ) : (
          addLabel
        )
      }
      hint={
        ratio !== null ? (
          <span
            className={cn(
              "flex items-center gap-1.5",
              low && "text-amber-600 dark:text-amber-500",
            )}
          >
            {low && <AlertTriangleIcon className="size-3.5 shrink-0" />}
            {low
              ? t("contrastLow", { ratio: ratio.toFixed(1) })
              : t("contrastOk", { ratio: ratio.toFixed(1) })}
          </span>
        ) : undefined
      }
      action={
        <Popover>
          <PopoverTrigger
            render={(props) =>
              filled ? (
                <button
                  {...props}
                  type="button"
                  aria-label={title}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <MoreHorizontalIcon className="size-4" />
                </button>
              ) : (
                <BrandAddButton {...props} label={addLabel} />
              )
            }
          />
          <PopoverContent align="end" className="w-72 gap-3 p-3">
            <p className="text-sm font-medium">{title}</p>
            <Swatch
              label={t("backgroundColor")}
              value={background}
              onChange={onBackgroundChange}
            />
            <Swatch
              label={t("foregroundColor")}
              value={foreground}
              onChange={onForegroundChange}
            />
            {filled && (
              <button
                type="button"
                onClick={clear}
                className="self-start text-xs text-destructive transition-colors hover:underline"
              >
                {tCommon("clear")}
              </button>
            )}
          </PopoverContent>
        </Popover>
      }
    />
  )
}

/**
 * A native colour well beside the hex it produced.
 *
 * Both edit the same value, and the text field is not normalised while it is
 * being typed — `#ab` is a legal thing to have half-written, and rewriting it
 * under the cursor is how a hex input becomes unusable. `onBlur` is where it
 * settles, because by then the vendor has stopped.
 */
function Swatch({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const id = useId()
  const normalized = normalizeHex(value)

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={normalized ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          placeholder="#000000"
          dir="ltr"
          className="font-mono text-sm"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const settled = normalizeHex(e.target.value)
            if (settled && settled !== e.target.value) onChange(settled)
          }}
        />
      </div>
    </label>
  )
}
