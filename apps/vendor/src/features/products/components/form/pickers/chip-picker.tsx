"use client"

import { useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { CirclePlusIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"

export interface PickerOption {
  id: string
  label: string
}

/**
 * One labelled block of the list. `label` is omitted for a single ungrouped
 * run, which is what the collections picker renders.
 */
export interface PickerGroup {
  label?: string
  options: PickerOption[]
}

interface ChipPickerProps {
  /** Already-localized field label, shown beside the add button. */
  label: string
  /**
   * Already-localized "Add tags" / "Add collections" — the accessible name of
   * both openers and the text on the empty-state pill.
   *
   * It is a prop rather than `Add ${label.toLowerCase()}` because that
   * composition is English grammar wearing a variable: it assumes the verb
   * comes first, that lower-casing a noun is meaningful, and that a caller's
   * label is a bare noun to begin with. Arabic answers no to all three. So the
   * caller passes the whole sentence, already translated.
   */
  addLabel: string
  value: string[]
  onChange: (ids: string[]) => void
  groups: PickerGroup[]
  /** Labels for selected ids that are not in `groups` (edit mode, paging). */
  snapshots?: Record<string, string>
  /** Heading inside the panel. Defaults to `label`. */
  title?: string
  /** Defaults to the shared `common.search`. */
  searchPlaceholder?: string
  /**
   * Create-from-the-query row, offered only when the search matches nothing.
   * Resolving with an id selects it; resolving with null leaves the selection
   * alone (the caller reported its own failure).
   */
  onCreateOption?: (name: string) => Promise<string | null>
  createLabel?: (query: string) => string
  /** A row pinned under the list whatever the query is. Closes the panel. */
  footerAction?: { label: string; onSelect: () => void }
  disabled?: boolean
}

/**
 * The product form's list-of-things control: a read-only box of chips with an
 * add button beside the label, and a panel of searchable checkbox rows behind
 * it. Tags and collections are the same interaction on different data, so they
 * are the same component — only the groups, the create row and the footer
 * action differ.
 *
 * Exactly one thing opens the panel at a time, and which one it is depends on
 * whether anything is selected: an empty field offers a single `Add tags` pill
 * inside the box, a filled one moves the affordance to the small button on the
 * label row beside the chips. Two openers at once is the shape to avoid -- the
 * second sits outside the panel and fights its own outside-press dismissal, so
 * the press closes it and the click reopens it and the control reads as stuck.
 *
 * Because the trigger swaps as the first chip lands, the popup is anchored to
 * the field wrapper instead. An anchor that unmounts mid-open takes the popup's
 * position with it.
 */
export function ChipPicker({
  label,
  addLabel,
  value,
  onChange,
  groups,
  snapshots = {},
  title,
  searchPlaceholder,
  onCreateOption,
  createLabel,
  footerAction,
  disabled,
}: ChipPickerProps) {
  // The panel's own vocabulary, shared with `ValueCombobox` so the two controls
  // in the organization card read the same. A hook cannot run in a default
  // parameter, so the fallbacks are resolved in the body instead.
  const t = useTranslations("products.picker")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  /** Stable popup anchor, since the trigger moves between the two states. */
  const fieldRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  /** Labels for ids created here, so a chip renders before the list refetches. */
  const [created, setCreated] = useState<Record<string, string>>({})

  const byId = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groups) {
      for (const option of group.options) map.set(option.id, option.label)
    }
    for (const [id, name] of Object.entries({ ...snapshots, ...created })) {
      if (!map.has(id)) map.set(id, name)
    }
    return map
  }, [groups, snapshots, created])

  const trimmed = query.trim()

  const filtered = useMemo(() => {
    const needle = trimmed.toLowerCase()
    if (!needle) return groups.filter((g) => g.options.length > 0)
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((o) =>
          o.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.options.length > 0)
  }, [groups, trimmed])

  const matchCount = filtered.reduce((n, g) => n + g.options.length, 0)
  // An exact hit means the thing already exists — offering to create it again
  // is how a shop ends up with two tags of the same name.
  const exactMatch = groups.some((group) =>
    group.options.some(
      (o) => o.label.trim().toLowerCase() === trimmed.toLowerCase(),
    ),
  )
  const canCreate = !!onCreateOption && trimmed.length > 0 && !exactMatch

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange([...value, id])
  }

  const create = async () => {
    if (!onCreateOption || creating) return
    setCreating(true)
    try {
      const id = await onCreateOption(trimmed)
      if (id) {
        setCreated((prev) => ({ ...prev, [id]: trimmed }))
        if (!value.includes(id)) onChange([...value, id])
        setQuery("")
      }
    } finally {
      setCreating(false)
    }
  }

  const empty = value.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div ref={fieldRef} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          {!empty && (
            <PopoverTrigger
              render={(props) => (
                <button
                  {...props}
                  type="button"
                  disabled={disabled}
                  aria-label={addLabel}
                  className="rounded-full text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  <CirclePlusIcon className="size-4" />
                </button>
              )}
            />
          )}
        </div>

        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-1.5 dark:bg-input/30">
          {empty ? (
            <PopoverTrigger
              render={(props) => (
                <button
                  {...props}
                  type="button"
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  <CirclePlusIcon className="size-3.5 opacity-70" />
                  {addLabel}
                </button>
              )}
            />
          ) : (
            value.map((id) => (
              <span
                key={id}
                className="group/chip inline-flex items-center gap-1 rounded-md bg-accent py-1 ps-2 pe-1 text-xs text-accent-foreground transition-colors hover:bg-accent/60"
              >
                <span className="max-w-40 min-w-0 truncate">
                  {byId.get(id) ?? id}
                </span>
                {/*
                  The X fades and scales in on hover, but its **space is
                  reserved at rest** — revealing it by growing the chip would
                  reflow the whole wrapped box, and the last chip would jump to
                  the next line out from under the pointer mid-click.

                  Two things keep it from being a control only a mouse can
                  find: `focus-visible` reveals it for the keyboard, and a
                  screen with no hover at all draws it permanently, since there
                  the reveal would never fire and this is the only way to
                  remove a chip.

                  `shrink-0` is the separate bug it also fixes — the chip is a
                  flex item in a wrapping row, so without it a tight row
                  squeezes the button to nothing and the 12px glyph overflows
                  back across the last letters of the label.
                */}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  disabled={disabled}
                  aria-label={t("remove", { name: byId.get(id) ?? id })}
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground",
                    "scale-75 opacity-0 transition duration-150 ease-out",
                    "group-hover/chip:scale-100 group-hover/chip:opacity-100",
                    "hover:bg-foreground/10 hover:text-foreground",
                    "focus-visible:scale-100 focus-visible:opacity-100",
                    "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    "[@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100",
                    "motion-reduce:transition-none",
                    // No `disabled:opacity-50` — it would out-specify the
                    // resting `opacity-0` and print a dimmed X on a chip that
                    // cannot be removed.
                    "disabled:pointer-events-none",
                  )}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <PopoverContent anchor={fieldRef} align="end" className="gap-0 p-0">
        <p className="px-3 pt-3 pb-1 text-sm font-medium">{title ?? label}</p>

        <div className="relative border-b">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? tCommon("search")}
            className="h-10 rounded-none border-0 bg-transparent ps-9 pe-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearSearch")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {matchCount === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {trimmed ? t("noResults") : t("empty")}
            </p>
          )}

          {filtered.map((group, index) => (
            <div key={group.label ?? `group-${index}`}>
              {group.label && (
                <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.options.map((option) => {
                const selected = value.includes(option.id)
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition",
                      selected ? "bg-accent font-medium" : "hover:bg-accent/60",
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggle(option.id)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                  </label>
                )
              })}
            </div>
          ))}

          {canCreate && (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm font-medium transition hover:bg-accent/60 disabled:opacity-60"
            >
              <PlusIcon className="size-4 shrink-0" />
              <span className="truncate">
                {creating
                  ? t("adding")
                  : (createLabel?.(trimmed) ?? t("create", { query: trimmed }))}
              </span>
            </button>
          )}

          {footerAction && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                footerAction.onSelect()
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm font-medium transition hover:bg-accent/60"
            >
              <PlusIcon className="size-4 shrink-0" />
              <span className="truncate">{footerAction.label}</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
