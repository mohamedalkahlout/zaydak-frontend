"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"

interface ValueComboboxProps {
  /** Announced on the trigger; the visible label is the `Field` above it. */
  label: string
  value: string
  onChange: (value: string) => void
  /** What the shop already uses for this field. */
  options: string[]
  /** Defaults to `products.picker.selectOrAdd`. */
  placeholder?: string
  /** Defaults to `products.picker.searchOrAdd`. */
  searchPlaceholder?: string
  /** Prefix for the create row. Defaults to `products.picker.create`. */
  createLabel?: (query: string) => string
  disabled?: boolean
}

/**
 * One free-text value, picked from what the shop already uses or typed anew —
 * the control behind Type and Vendor.
 *
 * Both fields are free text on the server, and free text left to itself
 * becomes three spellings of one vendor. So this is not a text input: it
 * opens on the values already in the catalogue, and only a query matching
 * none of them offers to create one. That is the whole reason the field is a
 * picker rather than the `<input>` it used to be — the vocabulary is the
 * shop's, but it should be *one* vocabulary.
 *
 * Picking the value already selected clears it, which is the only way back to
 * empty once something is chosen; a separate clear button on the trigger
 * would be a second control for a field that has three states.
 *
 * The panel is deliberately the same shape as `ChipPicker`'s — search box
 * over a scrolling list with a create row at its foot — because the two sit
 * in the same card, and two panels that behave differently in one card is a
 * card the merchant has to learn twice.
 */
export function ValueCombobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  createLabel,
  disabled,
}: ValueComboboxProps) {
  // Deliberately the same namespace `ChipPicker` reads: the two panels sit in
  // one card, and one vocabulary is the whole reason they look alike. A hook
  // cannot run in a default parameter, so the fallbacks land in the body.
  const t = useTranslations("products.picker")
  const triggerText = placeholder ?? t("selectOrAdd")
  const searchText = searchPlaceholder ?? t("searchOrAdd")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Measured when the panel opens so it covers the field exactly, the way
  // Shopify's does. Read in the open handler rather than during render, which
  // is what keeps it out of an effect and off the render path.
  const [width, setWidth] = useState<number>()

  const trimmed = query.trim()
  const needle = trimmed.toLowerCase()
  const matches = options.filter((o) => o.toLowerCase().includes(needle))
  // An exact hit already exists — offering to add it again is how a catalogue
  // ends up with two vendors of the same name.
  const exact = options.some((o) => o.toLowerCase() === needle)
  const canCreate = trimmed.length > 0 && !exact

  const commit = (next: string) => {
    onChange(next)
    setQuery("")
    setOpen(false)
  }

  const onOpenChange = (next: boolean) => {
    if (next) setWidth(triggerRef.current?.offsetWidth)
    else setQuery("")
    setOpen(next)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={(props) => (
          <button
            {...props}
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-label={label}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors dark:bg-input/30",
              "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span
              className={cn(
                "min-w-0 truncate",
                !value && "text-muted-foreground",
              )}
            >
              {value || triggerText}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </button>
        )}
      />

      <PopoverContent
        align="start"
        sideOffset={4}
        style={width ? { width } : undefined}
        className="gap-0 p-0"
      >
        <div className="relative border-b">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchText}
            aria-label={searchText}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              // Enter takes the obvious answer: the first match, or the value
              // being created when nothing matches.
              e.preventDefault()
              if (matches[0]) commit(matches[0])
              else if (canCreate) commit(trimmed)
            }}
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
          {matches.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {trimmed ? t("noResults") : t("empty")}
            </p>
          )}

          {matches.map((option) => {
            const selected = option === value
            return (
              <button
                key={option}
                type="button"
                // Clicking what is already chosen clears the field.
                onClick={() => commit(selected ? "" : option)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm transition",
                  selected ? "bg-accent font-medium" : "hover:bg-accent/60",
                )}
              >
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{option}</span>
              </button>
            )
          })}

          {canCreate && (
            <button
              type="button"
              onClick={() => commit(trimmed)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm font-medium transition hover:bg-accent/60"
            >
              <PlusIcon className="size-4 shrink-0" />
              <span className="truncate">
                {createLabel?.(trimmed) ?? t("create", { query: trimmed })}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
