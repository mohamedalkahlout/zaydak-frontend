"use client";

import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface FilterChipProps {
  /** The key's label — the grey half of "Tag is | Unisex". */
  label: string;
  /** Already-resolved value text; empty while the key is still pending. */
  values?: string;
  /** The key whose values the dropdown is currently showing. */
  active?: boolean;
  /** Reopens the key's values for editing. */
  onClick?: () => void;
  /** Clears the key; a pending chip goes back to the key list. */
  onRemove?: () => void;
}

/**
 * One applied filter, drawn the way Shopify's admin draws it: a segmented
 * pill, the key on grey and the values on blue, reading as one sentence in
 * two tones. One chip per key however many values it carries.
 *
 * The blue is a raw Tailwind colour rather than a token because the palette
 * has no interactive blue — its `--primary` is ink — and the status pills in
 * the same list take their emerald and amber the same way.
 *
 * Two controls, and they are two elements because a button cannot hold a
 * button: the pill edits (click reopens the key's values) and the X at its
 * end removes. The X **keeps its space at rest** and only its glyph fades and
 * scales in on hover — revealing the button itself would resize the pill and
 * shove the input out from under the pointer mid-click. `focus-visible`
 * reveals it for the keyboard and a screen with no hover draws it
 * permanently, since there the reveal would never fire and this is the only
 * way to remove a chip.
 *
 * Both prevent `mousedown` so a click never takes focus off the bar's input:
 * the dropdown is driven by that input, and a chip that stole focus would
 * close the list it is trying to open.
 */
export function FilterChip({
  label,
  values,
  active,
  onClick,
  onRemove,
}: FilterChipProps) {
  const t = useTranslations("products.filters");
  const valueTone =
    "bg-blue-50 text-blue-600 group-hover/chip:bg-blue-100 dark:bg-blue-400/15 dark:text-blue-300 dark:group-hover/chip:bg-blue-400/25";
  const keyTone =
    "bg-muted text-foreground group-hover/chip:bg-accent dark:group-hover/chip:bg-accent";
  /** The X continues whichever segment it follows, so the pill stays one shape. */
  const tailTone = values ? valueTone : keyTone;

  return (
    <div
      className={cn(
        "group/chip inline-flex h-full gap-[2px] max-w-full shrink-0 items-center text-sm whitespace-nowrap transition-colors",
      )}
    >
      <button
        type="button"
        aria-label={t("editChip", { label })}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="inline-flex h-full min-w-0 items-center rounded-s-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span
          className={cn(
            "flex h-full items-center rounded-s-md px-2 transition-colors",
            !values && !onRemove && "rounded-e-md",
            keyTone,
          )}
        >
          {t("chipKey", { label })}
        </span>
      </button>
      <div className="inline-flex h-full max-w-full shrink-0 items-center rounded-e-md">
        {values ? (
          <div
            className={cn(
              "flex h-full min-w-0 rounded-e-md items-center truncate ps-2 transition-colors",

              valueTone,
            )}
          >
            {values}
            {onRemove && (
              <button
                type="button"
                aria-label={t("removeChip", { label })}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onRemove}
                className={cn(
                  "grid h-full w-6 shrink-0 place-items-center rounded-e-md pe-1 transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  // The glyph is what hides, so the button keeps its place in the
                  // pill; its own focus has to reveal it or the keyboard cannot
                  // see what it is about to press.
                  "focus-visible:[&>svg]:scale-100 focus-visible:[&>svg]:opacity-100",
                  tailTone,
                )}
              >
                <XIcon
                  strokeWidth={2.5}
                  className={cn(
                    "size-3 scale-75 opacity-0 transition duration-150 ease-out",
                    "group-hover/chip:scale-100 group-hover/chip:opacity-100",
                    "[@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100",
                    "motion-reduce:transition-none",
                  )}
                />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
