"use client";

import * as React from "react";
import { motion } from "motion/react";
import { XIcon } from "lucide-react";

import { useSafeReducedMotion } from "../hooks/use-hydrated";
import { cn } from "../lib/utils";

/**
 * A tag picker where a chip *travels* between the two trays instead of
 * disappearing from one and appearing in the other: the tray on top holds what
 * is selected, the panel below holds what is still available, and every chip
 * shares a `layoutId` across both so motion animates the move.
 *
 * Presentational and store-free, like everything else here — pass
 * already-localized `label`s in, and an already-localized `removeLabel` for the
 * X button's accessible name.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 * Selection order is the order of the ids, so the chips sit in the tray in the
 * order they were picked.
 */

export type Tag = {
  id: string;
  label: string;
};

export interface TagsSelectorProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** Everything that can be picked, in the order the panel should list it. */
  tags: Tag[];
  /** Selected ids — pass with `onValueChange` to control the component. */
  value?: string[];
  /** Initial selected ids when uncontrolled. */
  defaultValue?: string[];
  onValueChange?: (ids: string[]) => void;
  /** Already-localized heading. Omit to render no heading. */
  label?: string;
  /** Already-localized hint shown in the tray while nothing is selected. */
  placeholder?: string;
  /** Already-localized accessible name for a chip's remove button. */
  removeLabel?: (tag: Tag) => string;
  disabled?: boolean;
}

/**
 * Layout animations correct the scale distortion of an animating box only when
 * the radius is a number motion can read and re-project — a Tailwind
 * `rounded-*` class would smear during the travel. Hence the inline radii.
 */
const TRAY_RADIUS = 16;
const CHIP_RADIUS = 14;

export function TagsSelector({
  tags,
  value,
  defaultValue,
  onValueChange,
  label,
  placeholder,
  removeLabel,
  disabled = false,
  className,
  ...props
}: TagsSelectorProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(
    () => defaultValue ?? [],
  );
  const selectedIds = value ?? uncontrolled;

  const trayRef = React.useRef<HTMLDivElement>(null);
  const previousCount = React.useRef(selectedIds.length);
  const reduced = useSafeReducedMotion();

  const byId = React.useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const selected = React.useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((tag): tag is Tag => tag !== undefined),
    [selectedIds, byId],
  );
  const available = React.useMemo(
    () => tags.filter((tag) => !selectedIds.includes(tag.id)),
    [tags, selectedIds],
  );

  const commit = (ids: string[]) => {
    if (value === undefined) setUncontrolled(ids);
    onValueChange?.(ids);
  };

  const addTag = (tag: Tag) => commit([...selectedIds, tag.id]);
  const removeTag = (id: string) =>
    commit(selectedIds.filter((selectedId) => selectedId !== id));

  /**
   * Keep the newest chip in view. Only on growth — scrolling to the end after a
   * removal would yank the tray away from the chip the pointer is still over.
   * In RTL the scroll range runs from `-scrollWidth` to 0, so the end is the
   * negative extreme; both values clamp.
   */
  React.useEffect(() => {
    const tray = trayRef.current;
    const grew = selectedIds.length > previousCount.current;
    previousCount.current = selectedIds.length;
    if (!tray || !grew) return;

    const rtl = getComputedStyle(tray).direction === "rtl";
    tray.scrollTo?.({
      left: rtl ? -tray.scrollWidth : tray.scrollWidth,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [selectedIds, reduced]);

  const transition = reduced ? { duration: 0 } : undefined;

  return (
    <div
      data-slot="tags-selector"
      className={cn("flex w-full flex-col", className)}
      {...props}
    >
      {label ? (
        <motion.h2
          layout
          transition={transition}
          className="text-xl font-semibold"
        >
          {label}
        </motion.h2>
      ) : null}

      <motion.div
        ref={trayRef}
        data-slot="tags-selector-tray"
        layout
        transition={transition}
        style={{ borderRadius: TRAY_RADIUS }}
        className={cn(
          "mb-3 flex h-14 w-full items-center justify-start gap-1.5 overflow-x-auto border bg-card p-1.5",
          label ? "mt-2" : "mt-0",
        )}
      >
        {selected.length === 0 && placeholder ? (
          <span className="px-2 text-sm text-muted-foreground">
            {placeholder}
          </span>
        ) : null}

        {selected.map((tag) => (
          <motion.div
            key={tag.id}
            data-slot="tags-selector-chip"
            layoutId={`tag-${tag.id}`}
            transition={transition}
            style={{ borderRadius: CHIP_RADIUS }}
            className="flex h-full shrink-0 items-center gap-1 border bg-card py-1 ps-3 pe-1 shadow-md"
          >
            <motion.span
              layoutId={`tag-${tag.id}-label`}
              transition={transition}
              className="font-medium text-foreground"
            >
              {tag.label}
            </motion.span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeTag(tag.id)}
              aria-label={removeLabel?.(tag)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <XIcon className="size-5" />
            </button>
          </motion.div>
        ))}
      </motion.div>

      {available.length > 0 ? (
        <motion.div
          data-slot="tags-selector-panel"
          layout
          transition={transition}
          style={{ borderRadius: TRAY_RADIUS }}
          className="w-full border bg-card p-2 shadow-sm"
        >
          <div className="flex flex-wrap gap-2">
            {available.map((tag) => (
              <motion.button
                key={tag.id}
                data-slot="tags-selector-option"
                type="button"
                layoutId={`tag-${tag.id}`}
                transition={transition}
                disabled={disabled}
                onClick={() => addTag(tag)}
                style={{ borderRadius: CHIP_RADIUS }}
                className="flex shrink-0 items-center gap-1 bg-muted px-4 py-2.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                <motion.span
                  layoutId={`tag-${tag.id}-label`}
                  transition={transition}
                  className="font-medium text-foreground"
                >
                  {tag.label}
                </motion.span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
