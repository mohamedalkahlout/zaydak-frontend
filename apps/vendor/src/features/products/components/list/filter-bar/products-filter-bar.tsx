"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import { Popover, PopoverContent } from "@repo/ui/components/popover"
import { Separator } from "@repo/ui/components/separator"
import { cn } from "@/shared/lib/utils"
import {
  PRODUCT_FILTER_KEYS,
  activeFilterKeys,
  filterPatch,
  filterValuesOf,
  findFilterKey,
  type ProductFilterKey,
  type ProductFilterKeyId,
} from "@/features/products/lib/list/filters"
import type { ProductListQueryState } from "@/features/products/lib/list/query-state"
import { FilterChip } from "./filter-chip"
import {
  FilterOptionList,
  filterOptionId,
  type FilterRow,
} from "./filter-option-list"
import { useFilterOptions } from "./use-filter-options"

/** How long the list waits after the last keystroke before it refetches. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The most value rows drawn at once. Only the taxonomy comes near it, and a
 * vendor does not scroll 5500 rows — they type.
 */
const MAX_VALUE_ROWS = 60

interface ProductsFilterBarProps {
  state: ProductListQueryState
  onQueryChange: (
    patch: Partial<ProductListQueryState>,
    opts?: { resetPage?: boolean },
  ) => void
  /** Clears every filter and the search — the table's own reset. */
  onReset: () => void
  /** Rendered inside the bar, at its start: the view selector. */
  leading?: React.ReactNode
  /** Rendered inside the bar, after the clear button. */
  trailing?: React.ReactNode
  /**
   * Chip row only — no boxed search. The list chrome owns search and the
   * funnel; this bar draws chips and the value menu.
   */
  chrome?: boolean
  /** Funnel pick of an async key. Applied during render, then ignored. */
  startKey?: { id: ProductFilterKeyId; nonce: number } | null
  onDismissStart?: () => void
}

/**
 * One field for both searching and filtering, the way Shopify's product list
 * does it. Typing is a product search; focusing the empty field lists the
 * filter keys by name; picking one turns into a chip ("Tag is") and the list
 * becomes that key's values, each toggle written to the URL at once.
 *
 * The URL is the only state that matters. Chips are derived from it
 * (`activeFilterKeys`), so the bar can never show a filter the list is not
 * applying; the only local pieces are the text, which key's values the
 * dropdown is showing, the highlighted row, and whether it is open. A key
 * that has been picked but has no values yet is the one chip that exists
 * only locally, and it disappears with the dropdown.
 *
 * The dropdown is a `Popover` with no trigger — `open` is controlled and it
 * anchors to the input — because the table card is `overflow-hidden`, and a
 * list rendered inline would be clipped at the card's edge. `initialFocus`
 * is off so opening never moves focus off the input, which is what drives
 * the list; base-ui's outside-press is ignored when it lands on the field
 * itself, since clicking the input you are typing in is not leaving.
 *
 * Search text is local so the field does not lag the debounce. While a key
 * is active the same text is that key's narrower instead, so entering value
 * mode blanks it and leaving restores the applied search — a search the
 * list is still applying must never be invisible in the field. It is
 * re-seeded from `state.search` during render when the URL moves under it
 * (reset, back button, a view change) — compared against `seededFrom`
 * rather than synced in an effect, so the input never paints one frame with
 * the old value. The bar's own debounced write is also a `state.search`
 * change, and one that can land hundreds of milliseconds after it was sent
 * (the list refetches inside a transition), by which time the vendor has
 * typed on; `lastApplied` remembers what this bar sent so its own write
 * landing leaves the text alone and only a genuinely outside change re-seeds.
 */
export function ProductsFilterBar({
  state,
  onQueryChange,
  onReset,
  leading,
  trailing,
  chrome = false,
  startKey,
  onDismissStart,
}: ProductsFilterBarProps) {
  const t = useTranslations("products.filters")
  /** What a key reads in this locale — the key table carries no words. */
  const keyLabel = (key: ProductFilterKey) => t(`keys.${key.id}.label`)
  const listId = useId()
  const chipId = `${listId}-active-chip`
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The debounced search fires up to 300ms after the keystroke that scheduled
  // it, by which time the parent's `updateQuery` may have been rebuilt around
  // a newer URL (the vendor switched view meanwhile). Calling the version
  // captured at schedule time would write that stale URL back, so the timer
  // reads the latest through a ref that an effect keeps current.
  const latest = useRef({ state, onQueryChange })
  useEffect(() => {
    latest.current = { state, onQueryChange }
  })

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const [open, setOpen] = useState(false)
  const [activeKeyId, setActiveKeyId] = useState<ProductFilterKeyId | null>(
    null,
  )
  const [activeIndex, setActiveIndex] = useState(0)
  // Bumped by the arrow keys only, so the list scrolls the highlight into
  // view for the keyboard and not under a pointer that merely crossed a row.
  const [keyboardNav, setKeyboardNav] = useState(0)
  const [seededStart, setSeededStart] = useState(0)

  const [text, setText] = useState(state.search ?? "")
  const [seededFrom, setSeededFrom] = useState(state.search)
  const [lastApplied, setLastApplied] = useState(state.search)
  if (state.search !== seededFrom) {
    setSeededFrom(state.search)
    if (state.search !== lastApplied) {
      setLastApplied(state.search)
      // In value mode the text is the narrower, never the search; the
      // restored search is written back when the key is left.
      if (!activeKeyId) setText(state.search ?? "")
    }
  }
  if (startKey && startKey.nonce !== seededStart) {
    setSeededStart(startKey.nonce)
    setActiveKeyId(startKey.id)
    setOpen(true)
    setText("")
    setActiveIndex(0)
  }

  const activeKey = activeKeyId ? (findFilterKey(activeKeyId) ?? null) : null
  const { optionsOf, labelOf, loadingOf } = useFilterOptions(state, activeKey)

  const applied = activeFilterKeys(state)
  const activeValues = activeKey ? filterValuesOf(state, activeKey) : []
  /** A picked key with nothing chosen yet — the chip that is only local. */
  const pending = activeKey && activeValues.length === 0 ? activeKey : null
  const needle = text.trim().toLowerCase()
  const selectedKey = activeValues.join(" ")

  const allRows = useMemo<FilterRow[]>(() => {
    if (!activeKey) {
      // Matched against the words on screen, so an Arabic merchant typing
      // "وسم" finds Tag the way "ta" does in English.
      const keys = PRODUCT_FILTER_KEYS.filter(
        (key) =>
          !needle ||
          t(`keys.${key.id}.label`).toLowerCase().includes(needle),
      )
      // Nothing typed names a key, so the only thing to offer is the search
      // itself — Enter on it applies at once instead of after the debounce.
      if (keys.length === 0 && needle) {
        return [{ kind: "search", text: text.trim() }]
      }
      return keys.map((key) => ({ kind: "key", key }))
    }
    const selected = new Set(selectedKey ? selectedKey.split(" ") : [])
    return optionsOf(activeKey)
      .filter(
        (option) =>
          !needle ||
          option.label.toLowerCase().includes(needle) ||
          option.hint?.toLowerCase().includes(needle),
      )
      .map((option) => ({
        kind: "value",
        option,
        selected: selected.has(option.id),
      }))
  }, [activeKey, needle, text, optionsOf, selectedKey, t])

  // Memoised so a render that changed nothing hands the option list the
  // same array rather than a fresh slice of the taxonomy to reconcile.
  const rows = useMemo(
    () =>
      allRows.length > MAX_VALUE_ROWS ? allRows.slice(0, MAX_VALUE_ROWS) : allRows,
    [allRows],
  )
  const truncated = allRows.length - rows.length
  // Clamped for rendering rather than reset in an effect: rows shrink as the
  // vendor types, and the highlight just has to stay on a row that exists.
  const safeIndex = rows.length === 0 ? 0 : Math.min(activeIndex, rows.length - 1)
  const loading = activeKey ? loadingOf(activeKey) : false

  const emptyText = !activeKey
    ? t("noKeysMatch")
    : needle
      ? t(`keys.${activeKey.id}.noMatch`, { query: text.trim() })
      : t(`keys.${activeKey.id}.empty`)

  const cancelSearch = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  const applySearch = (value: string) => {
    cancelSearch()
    const next = value.trim() || undefined
    const current = latest.current
    setLastApplied(next)
    if (current.state.search === next) return
    current.onQueryChange({ search: next }, { resetPage: true })
  }

  const scheduleSearch = (value: string) => {
    cancelSearch()
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      applySearch(value)
    }, SEARCH_DEBOUNCE_MS)
  }

  /**
   * Back to key mode. The narrowing text was never a product search, so it
   * goes, and the search the list is still applying comes back into the
   * field where the vendor can see it.
   */
  const leaveValueMode = () => {
    setActiveKeyId(null)
    setText(chrome ? "" : (state.search ?? ""))
    onDismissStart?.()
  }

  const close = () => {
    setOpen(false)
    setActiveIndex(0)
    if (activeKeyId) leaveValueMode()
  }

  const pickKey = (key: ProductFilterKey) => {
    cancelSearch()
    // A key name is not a product query: if "ta" already went out as the
    // search before Enter picked Tag, take it back — whether the URL shows it
    // yet or not, which is what `lastApplied` is for.
    const typed = text.trim()
    if (typed && (state.search === typed || lastApplied === typed)) {
      setLastApplied(undefined)
      onQueryChange({ search: undefined }, { resetPage: true })
    }
    setActiveKeyId(key.id)
    setText("")
    setActiveIndex(0)
    setOpen(true)
  }

  const editKey = (key: ProductFilterKey) => {
    cancelSearch()
    setActiveKeyId(key.id)
    setText("")
    setActiveIndex(0)
    setOpen(true)
    inputRef.current?.focus()
  }

  const clearKey = (key: ProductFilterKey) => {
    onQueryChange(filterPatch(key, []), { resetPage: true })
    if (activeKeyId === key.id) setActiveKeyId(null)
    setActiveIndex(0)
  }

  const toggleValue = (key: ProductFilterKey, id: string) => {
    const values = filterValuesOf(state, key)
    const has = values.includes(id)
    const next = key.multiple
      ? has
        ? values.filter((v) => v !== id)
        : [...values, id]
      : has
        ? []
        : [id]
    onQueryChange(filterPatch(key, next), { resetPage: true })
  }

  const activateRow = (index: number) => {
    const row = rows[index]
    if (!row) return
    if (row.kind === "key") pickKey(row.key)
    else if (row.kind === "search") {
      applySearch(row.text)
      setOpen(false)
    } else if (activeKey) {
      toggleValue(activeKey, row.option.id)
    }
  }

  const moveTo = (index: number) => {
    setActiveIndex(index)
    setKeyboardNav((n) => n + 1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setActiveIndex(0)
        } else if (rows.length > 0) {
          moveTo((safeIndex + 1) % rows.length)
        }
        return
      case "ArrowUp":
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setActiveIndex(0)
        } else if (rows.length > 0) {
          moveTo((safeIndex - 1 + rows.length) % rows.length)
        }
        return
      // Home and End jump the highlight only while there is no text for the
      // caret to jump through; otherwise they stay the editing keys they are.
      case "Home":
        if (open && rows.length > 0 && text === "") {
          e.preventDefault()
          moveTo(0)
        }
        return
      case "End":
        if (open && rows.length > 0 && text === "") {
          e.preventDefault()
          moveTo(rows.length - 1)
        }
        return
      case "Enter":
        e.preventDefault()
        if (open && rows.length > 0) activateRow(safeIndex)
        else if (!activeKey) applySearch(text)
        return
      case "Escape":
        if (open) {
          e.preventDefault()
          close()
        }
        return
      case "Tab":
        if (open) close()
        return
      case "Backspace":
        if (text !== "") return
        // A pending chip goes first, back to the key list; otherwise the last
        // applied chip, whichever key it is.
        if (pending) {
          e.preventDefault()
          leaveValueMode()
          setActiveIndex(0)
          return
        }
        const last = applied[applied.length - 1]
        if (last) {
          e.preventDefault()
          clearKey(last)
        }
        return
    }
  }

  const onChange = (value: string) => {
    setText(value)
    setActiveIndex(0)
    if (!open) setOpen(true)
    // In value mode the text narrows the rows and is never a search.
    if (!activeKey && !chrome) scheduleSearch(value)
  }

  const clearAll = () => {
    cancelSearch()
    setText("")
    setLastApplied(undefined)
    setActiveKeyId(null)
    setActiveIndex(0)
    onReset()
    inputRef.current?.focus()
  }

  const chipValues = (key: ProductFilterKey) => {
    const ids = filterValuesOf(state, key)
    if (loadingOf(key)) return t("selectedCount", { count: ids.length })
    return ids.map((id) => labelOf(key, id)).join(", ")
  }

  const showClear =
    applied.length > 0 || text.length > 0 || !!state.search || !!activeKey
  const placeholder =
    chrome || applied.length > 0 || activeKey ? "" : t("placeholder")

  if (chrome && applied.length === 0 && !pending) {
    return null
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === "outside-press") {
          const target = details.event.target
          if (target instanceof Node && fieldRef.current?.contains(target)) {
            return
          }
        }
        close()
      }}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1",
          !chrome &&
            "rounded-lg border border-border bg-card ps-1 pe-1.5 transition-[box-shadow,border-color] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/50",
        )}
      >
        {!chrome && leading}
        {!chrome && leading && (
          <Separator orientation="vertical" className="mx-0.5 h-5 self-center" />
        )}

        <div
          ref={fieldRef}
          className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1 py-1"
          onClick={() => inputRef.current?.focus()}
        >
          {applied.map((key) => (
            <FilterChip
              key={key.id}
              label={keyLabel(key)}
              values={chipValues(key)}
              active={activeKeyId === key.id}
              onClick={() => editKey(key)}
              onRemove={() => {
                clearKey(key)
                inputRef.current?.focus()
              }}
            />
          ))}
          {pending && (
            <FilterChip
              label={keyLabel(pending)}
              active
              onClick={() => inputRef.current?.focus()}
              onRemove={() => {
                leaveValueMode()
                setActiveIndex(0)
                inputRef.current?.focus()
              }}
            />
          )}

          <input
            ref={inputRef}
            type="text"
            value={text}
            placeholder={placeholder}
            aria-label={t("inputLabel")}
            // Focus never leaves the input, so the chip being built is what
            // describes it — a screen reader hears "Tag is Unisex" with the
            // row. The chip's own name is its action ("Edit Tag filter"), so
            // the sentence is read from a hidden copy rather than the chip.
            aria-describedby={activeKey ? chipId : undefined}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && rows.length > 0 && !loading
                ? filterOptionId(listId, safeIndex)
                : undefined
            }
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              if (chrome && !activeKey) return
              setOpen(true)
            }}
            onClick={() => {
              if (!open) setOpen(true)
            }}
            onKeyDown={onKeyDown}
            className={cn(
              "h-6 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
              chrome && !activeKey ? "sr-only" : "min-w-24 flex-1",
            )}
          />
          <span id={chipId} role="status" className="sr-only">
            {activeKey
              ? t("chipSentence", {
                  label: keyLabel(activeKey),
                  values: chipValues(activeKey) || "…",
                })
              : ""}
          </span>
        </div>

        {!chrome && showClear && (
          <button
            type="button"
            aria-label={t("clearAll")}
            onClick={clearAll}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-4 place-items-center rounded-full border border-current">
              <XIcon className="size-2.5" strokeWidth={2.5} />
            </span>
          </button>
        )}

        {!chrome && trailing}
      </div>

      <PopoverContent
        // Anchored to the input, not the bar: the list answers what is being
        // typed, so it opens under the caret rather than out at the bar's
        // start edge, where it would sit under the view selector instead.
        // It follows the caret as chips push the input along, which is also
        // what keeps it beneath the input once the chips wrap to a new line.
        anchor={inputRef}
        align="start"
        sideOffset={4}
        initialFocus={false}
        finalFocus={false}
        className="w-[340px] max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <FilterOptionList
          id={listId}
          rows={rows}
          activeIndex={safeIndex}
          keyboardNav={keyboardNav}
          activeLabel={activeKey ? keyLabel(activeKey) : undefined}
          multiple={activeKey ? activeKey.multiple : undefined}
          loading={loading}
          emptyText={emptyText}
          truncated={truncated}
          onActivate={activateRow}
          onHover={setActiveIndex}
        />
      </PopoverContent>
    </Popover>
  )
}
