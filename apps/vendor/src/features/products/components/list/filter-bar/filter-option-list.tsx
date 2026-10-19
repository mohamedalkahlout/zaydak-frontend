"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { CheckIcon, SearchIcon } from "lucide-react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import type {
  ProductFilterKey,
  ProductFilterOption,
} from "@/features/products/lib/list/filters"

/** One row of the dropdown, whichever mode it is in. */
export type FilterRow =
  | { kind: "key"; key: ProductFilterKey }
  | { kind: "search"; text: string }
  | { kind: "value"; option: ProductFilterOption; selected: boolean }

/** The DOM id of row `index`, for `aria-activedescendant`. */
export function filterOptionId(listId: string, index: number): string {
  return `${listId}-option-${index}`
}

interface FilterOptionListProps {
  /** The listbox's own id — the input's `aria-controls`. */
  id: string
  rows: FilterRow[]
  activeIndex: number
  /**
   * A counter the bar bumps on every keyboard move of the highlight. The
   * highlighted row is scrolled into view when it changes, and only then.
   */
  keyboardNav: number
  /** The key whose values these are; names the listbox. Undefined in key mode. */
  activeLabel?: string
  /**
   * Set in value mode: `true` draws checkboxes and marks the list
   * multi-selectable, `false` draws a check mark beside the one chosen row.
   * Undefined in key mode.
   */
  multiple?: boolean
  loading?: boolean
  /** Shown in place of the rows when there is nothing to list. */
  emptyText?: string
  /** Matching rows cut off after the cap; the footer asks for more typing. */
  truncated?: number
  onActivate: (index: number) => void
  onHover: (index: number) => void
}

/**
 * The dropdown body: a listbox of filter keys, or of one key's values. It is
 * deliberately not `cmdk` — the bar's own input keeps focus and drives this
 * list through `aria-activedescendant`, so the rows are plain elements that
 * never take focus themselves. That is also why a value row draws its own
 * checkbox rather than mounting the `Checkbox` primitive: the row is the
 * control, and a second focusable one inside it is something the keyboard
 * model has no use for.
 *
 * The whole body prevents `mousedown`, not just the rows: a press on the
 * listbox's scrollbar, the padding between rows, or the footer would
 * otherwise move focus to the popup, and from then on the arrow keys and
 * typing reach nothing.
 *
 * The listbox holds options and nothing else — a `role="listbox"` permits
 * only option and group children, so anything else inside it is skipped by
 * a screen reader. The loading and empty states are siblings with
 * `role="status"`, which is what gets them announced when they appear in
 * place of rows that the reader can no longer find. The listbox element
 * stays mounted, empty, so the input's `aria-controls` still resolves.
 *
 * Scrolling the highlight into view is keyed on `keyboardNav` rather than
 * on the index: hovering also moves the highlight, and a list that scrolls
 * because the pointer crossed a half-visible row jumps under the pointer.
 */
export function FilterOptionList({
  id,
  rows,
  activeIndex,
  keyboardNav,
  activeLabel,
  multiple,
  loading,
  emptyText,
  truncated = 0,
  onActivate,
  onHover,
}: FilterOptionListProps) {
  const t = useTranslations("products.filters")
  const listRef = useRef<HTMLDivElement>(null)

  // jsdom has no `scrollIntoView`, hence the guard.
  useEffect(() => {
    if (keyboardNav === 0) return
    const el = listRef.current?.querySelector<HTMLElement>("[data-active]")
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [keyboardNav])

  return (
    <div className="flex flex-col" onMouseDown={(e) => e.preventDefault()}>
      <div
        ref={listRef}
        id={id}
        role="listbox"
        aria-multiselectable={multiple === true ? true : undefined}
        aria-label={
          activeLabel
            ? t("valuesLabel", { label: activeLabel })
            : t("filterBy")
        }
        className={cn("max-h-80 overflow-y-auto", rows.length > 0 && "p-1")}
      >
        {!loading &&
          rows.map((row, index) => {
            const active = index === activeIndex
            return (
              <div
                key={rowKey(row)}
                id={filterOptionId(id, index)}
                role="option"
                aria-selected={row.kind === "value" ? row.selected : active}
                data-active={active || undefined}
                title={row.kind === "value" ? row.option.hint : undefined}
                onClick={() => onActivate(index)}
                onMouseMove={() => {
                  if (!active) onHover(index)
                }}
                className={cn(
                  "flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                  "data-active:bg-muted",
                )}
              >
                <RowBody row={row} multiple={multiple} />
                {active && row.kind !== "value" && <EnterHint />}
              </div>
            )
          })}
      </div>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("loading")}
          className="flex flex-col gap-1 p-2"
        >
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : null}

      {truncated > 0 && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {t("typeToNarrow", { count: truncated })}
        </div>
      )}
    </div>
  )
}

function rowKey(row: FilterRow): string {
  switch (row.kind) {
    case "key":
      return `key:${row.key.id}`
    case "search":
      return "search"
    case "value":
      return `value:${row.option.id}`
  }
}

function RowBody({
  row,
  multiple,
}: {
  row: FilterRow
  multiple?: boolean
}) {
  const t = useTranslations("products.filters")
  if (row.kind === "key") {
    return (
      <span className="min-w-0 flex-1 truncate">
        {t(`keys.${row.key.id}.label`)}
      </span>
    )
  }

  if (row.kind === "search") {
    return (
      <>
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {t("searchFor", { text: row.text })}
        </span>
      </>
    )
  }

  const { option, selected } = row
  return (
    <>
      {multiple && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors",
            selected && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {selected && <CheckIcon className="size-3.5" />}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.hint && (
        <span
          aria-hidden="true"
          className="hidden max-w-[45%] truncate text-xs text-muted-foreground sm:inline"
        >
          {option.hint}
        </span>
      )}
      {!multiple && selected && (
        <CheckIcon className="size-4 shrink-0 text-primary" />
      )}
    </>
  )
}

/** The Enter hint on the highlighted row; decoration, so hidden from the accessible name. */
function EnterHint() {
  const t = useTranslations("products.filters")
  return (
    <kbd
      aria-hidden="true"
      className="ms-auto shrink-0 rounded border border-border bg-background px-1 font-sans text-[10px] leading-4 text-muted-foreground"
    >
      {t("enterHint")}
    </kbd>
  )
}
