"use client"

import * as React from "react"
import { AnimatePresence, motion, type Transition } from "motion/react"
import { PlusIcon, XIcon } from "lucide-react"

import { useSafeReducedMotion } from "../hooks/use-hydrated"
import { cn } from "../lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/* ------------------------------------------------------------------ types */

export interface FilterOption {
  value: string
  label: string
  /** A swatch, avatar or status dot drawn before the label. */
  glyph?: React.ReactNode
  /**
   * Already-localized trailing text in the value menu — typically a count.
   * Muted and tabular, and never searched: a person types the label. It is
   * not drawn on the chip, which says what is applied, not how many match.
   */
  hint?: string
}

export interface FilterOperatorDef {
  value: string
  /** Already-localized. */
  label: string
  /** Several values may be held at once — "is any of" rather than "is". */
  multi?: boolean
}

export interface FilterFieldDef {
  id: string
  /** Already-localized. */
  label: string
  icon?: React.ReactNode
  /** At least one. A field with exactly one renders it as plain text. */
  operators: FilterOperatorDef[]
  /** The values to choose from. Ignored when `loadOptions` is given. */
  options?: FilterOption[]
  /**
   * Already-localized. One muted line under the value list saying what the
   * options' `hint`s count — say so here whenever that is not "the rows the
   * current filters return", or the numbers read as a promise the list breaks.
   * Drawn only while at least one option carries a hint.
   */
  hintNote?: string
  /**
   * Fetches values for what has been typed. A field with this is searched on
   * the server, so the menu never filters the rows it is handed a second time.
   */
  loadOptions?: (query: string) => Promise<FilterOption[]>
  /**
   * Label for a value that is not one of `options` — a custom date window
   * the menu cannot list. Falls through to the option label, then the raw
   * value.
   */
  labelForValue?: (value: string) => string | undefined
  /**
   * Drawn under the value list, for a control the option list cannot
   * express. `commit` replaces the chip's values and closes the menu.
   */
  valueExtra?: (args: {
    values: string[]
    commit: (values: string[]) => void
  }) => React.ReactNode
}

/** One applied filter. The bar is controlled — this array is the whole state. */
export interface Filter {
  id: string
  field: string
  operator: string
  values: string[]
}

/**
 * Every string the bar draws, already localized: this package reads no
 * `next-intl`, so the app that renders the bar passes its own translations in.
 */
export interface FilterBarLabels {
  /** The add button once at least one filter is applied. */
  add: string
  /** The same button while the bar is empty — it is the only thing on it. */
  empty: string
  /** Stands in for a value segment with nothing chosen yet. */
  selectValue: string
  /** Placeholder of the search box inside a menu. */
  search: string
  /** Nothing matched what was typed. */
  noMatches: string
  /** Async values are on the wire. */
  loading: string
  /** Async values could not be fetched. */
  loadError: string
  /** Re-runs a failed fetch. */
  retry: string
  /** Drops every filter at once. */
  clear: string
  /** Accessible name of a chip's field segment. */
  editField: (field: string) => string
  /** Accessible name of a chip's operator segment. */
  editOperator: (field: string) => string
  /** Accessible name of a chip's value segment. */
  editValue: (field: string, value: string) => string
  /** Accessible name of a chip's remove button. */
  remove: (field: string) => string
}

/**
 * Hands the bar's Clear button over to the screen.
 *
 * The bar can only see chips, so its own Clear can only drop chips — and a
 * screen with a search box beside the bar therefore had to keep a second
 * control for the rest, leaving two clear-ish buttons a few pixels apart. A
 * screen that passes this owns all three parts of the one button the bar then
 * draws: what it does, what it says, and when it is worth offering.
 */
export interface FilterBarClear {
  /** Runs instead of the bar's own `onChange([])`. */
  onClear: () => void
  /** Already-localized. Replaces `labels.clear` on this screen's bar. */
  label?: string
  /**
   * Whether there is anything to clear. Defaults to the bar's own rule — two
   * chips or more, one being removable by its own X — which is all it can see;
   * a screen counting its search box too passes its own verdict.
   */
  active?: boolean
}

export interface FilterBarProps {
  fields: FilterFieldDef[]
  value: Filter[]
  onChange: (filters: Filter[]) => void
  labels: FilterBarLabels
  /**
   * Takes over the Clear button. Omit it and the bar clears its own chips,
   * which is right for a screen where the chips are the whole filter state.
   */
  clear?: FilterBarClear
  /** Rendered inside the bar, before the chips — a view selector, usually. */
  leading?: React.ReactNode
  /** Rendered inside the bar, after the clear button. */
  trailing?: React.ReactNode
  disabled?: boolean
  className?: string
  /**
   * The add control is the plus icon alone, with no dashed border and no
   * label. Screens that put the empty-bar trigger elsewhere (a funnel in a
   * chrome row) still need a quiet + next to the chips.
   *
   * Default is the labelled dashed button every other list already has.
   */
  compactAdd?: boolean
  "aria-label"?: string
}

/* ---------------------------------------------------------------- helpers */

/**
 * Ids only have to be unique within one mounted bar and are never persisted.
 * `randomUUID` where it exists, a counter where it does not — deliberately not
 * `Math.random()`, which `react-hooks/purity` flags and which would make this
 * unusable from a render body if it ever moved into one.
 */
let sequence = 0
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `filter-${(sequence += 1)}`

const fieldById = (fields: FilterFieldDef[], id: string) =>
  fields.find((f) => f.id === id)

const operatorByValue = (field: FilterFieldDef | undefined, value: string) =>
  field?.operators.find((o) => o.value === value)

/**
 * What a value segment reads. Up to three values are spelled out; beyond that
 * the first is named and the rest counted, so a chip never grows past its row.
 */
function summarize(
  options: FilterOption[] | undefined,
  values: string[],
  fallback: string,
  labelForValue?: (value: string) => string | undefined,
): { text: string; empty: boolean; glyphs: React.ReactNode[] } {
  if (values.length === 0) return { text: fallback, empty: true, glyphs: [] }

  const find = (v: string) => options?.find((o) => o.value === v)
  // Falls back to the raw value: an option the server no longer returns still
  // has to render as something that can be seen and removed. `labelForValue`
  // is the step before that, for a value the menu never listed.
  const label = (v: string) =>
    find(v)?.label ?? labelForValue?.(v) ?? v
  const glyphs = values
    .map((v) => find(v)?.glyph)
    .filter(Boolean)
    .slice(0, 3) as React.ReactNode[]

  if (values.length === 1)
    return { text: label(values[0]!), empty: false, glyphs }
  if (values.length <= 3)
    return { text: values.map(label).join(", "), empty: false, glyphs }
  return {
    text: `${label(values[0]!)} +${values.length - 1}`,
    empty: false,
    glyphs,
  }
}

interface AsyncState {
  loading: boolean
  error: boolean
  options: FilterOption[]
}

const EMPTY_ASYNC: AsyncState = { loading: false, error: false, options: [] }

/* ------------------------------------------------------------------- menu */

interface MenuItem {
  value: string
  label: string
  glyph?: React.ReactNode
  hint?: string
  selected?: boolean
}

interface OptionMenuProps {
  items: MenuItem[]
  multi: boolean
  labels: FilterBarLabels
  /** Hidden for a short list — a search box over four rows is furniture. */
  searchable?: boolean
  async?: AsyncState
  /** A muted footnote under the list; see `FilterFieldDef.hintNote`. */
  note?: string
  onQuery?: (query: string) => void
  onRetry?: () => void
  onPick: (value: string) => void
}

/**
 * The list behind every segment. Fields, operators and values all pick one
 * thing out of a searchable list, so they are one component.
 *
 * It is `Command` rather than a hand-rolled listbox because cmdk already owns
 * the parts that are easy to get subtly wrong — `aria-activedescendant`, the
 * roving highlight, Enter to commit, and the filtering itself. `shouldFilter`
 * is off for an async field, whose rows are already the answer to the query
 * and must not be narrowed a second time on the client.
 */
function OptionMenu({
  items,
  multi,
  labels,
  searchable = true,
  async,
  note,
  onQuery,
  onRetry,
  onPick,
}: OptionMenuProps) {
  const loading = async?.loading ?? false
  const failed = async?.error ?? false

  return (
    <Command shouldFilter={!onQuery} className="rounded-lg! bg-transparent p-0">
      {searchable && (
        <CommandInput placeholder={labels.search} onValueChange={onQuery} />
      )}
      <CommandList className="max-h-60">
        {loading && (
          <div
            role="status"
            className="px-3 py-3 text-sm text-muted-foreground"
          >
            {labels.loading}
          </div>
        )}

        {failed && !loading && (
          <div className="px-3 py-2.5 text-sm">
            <p className="text-muted-foreground">{labels.loadError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {labels.retry}
            </button>
          </div>
        )}

        {!loading && !failed && (
          <>
            <CommandEmpty>{labels.noMatches}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  // cmdk filters on `value`, so it carries the label a person
                  // types; the raw value stays searchable as a keyword.
                  value={item.label}
                  keywords={[item.value]}
                  onSelect={() => onPick(item.value)}
                >
                  {multi && (
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        item.selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      <CheckGlyph
                        className={item.selected ? undefined : "invisible"}
                      />
                    </span>
                  )}
                  {item.glyph && (
                    <span className="shrink-0" aria-hidden>
                      {item.glyph}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                  {item.hint != null && (
                    <span
                      data-slot="filter-option-hint"
                      className="ms-auto shrink-0 ps-2 text-xs text-muted-foreground tabular-nums"
                    >
                      {item.hint}
                    </span>
                  )}
                  {!multi && item.selected && (
                    <CheckGlyph
                      className={cn(
                        "shrink-0 text-muted-foreground",
                        item.hint == null && "ms-auto",
                      )}
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      {note && (
        <p
          data-slot="filter-option-note"
          className="border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {note}
        </p>
      )}
    </Command>
  )
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M2.5 6.2l2.2 2.3L9.5 3.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------------------------------------------------------------- segment */

interface SegmentProps extends React.ComponentProps<"button"> {
  /** Where in the chip it sits — the field segment carries the leading radius. */
  part: "field" | "operator" | "value"
  muted?: boolean
  open?: boolean
  flash?: boolean
}

const Segment = React.forwardRef<HTMLButtonElement, SegmentProps>(
  function Segment({ part, muted, open, flash, className, ...props }, ref) {
    return (
      <button
        type="button"
        ref={ref}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-slot="filter-bar-segment"
        className={cn(
          "relative flex items-center gap-1.5 whitespace-nowrap px-2 py-1 text-sm leading-snug transition-colors duration-500",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 focus-visible:outline-none",
          muted ? "text-muted-foreground" : "text-foreground",
          part === "field" && "rounded-s-md font-medium",
          open ? "bg-accent" : "hover:bg-accent/60",
          // The applied-value pulse: it lands instantly and fades back over the
          // base duration. A transition rather than a keyframe, because this
          // package ships no `@keyframes` and must not assume one the consuming
          // app has not declared.
          flash && "bg-primary/15 duration-0",
          className,
        )}
        {...props}
      />
    )
  },
)

/** The same box as a `Segment`, for an operator with nothing to choose from. */
function StaticSegment({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center whitespace-nowrap px-2 py-1 text-sm leading-snug text-muted-foreground">
      {children}
    </span>
  )
}

function Divider() {
  return <span aria-hidden className="w-px self-stretch bg-border" />
}

/* -------------------------------------------------------------------- bar */

type OpenState =
  | { kind: "add" }
  | { kind: "field" | "operator" | "value"; filterId: string }
  | null

/**
 * A row of segmented filter chips — field, operator, value — each segment its
 * own menu, plus one dashed button that adds another.
 *
 * The bar is fully controlled: `value` is the only state that matters and
 * every edit goes out through `onChange`, so a screen can hold its filters in
 * the URL, in TanStack's `columnFilters`, or in plain `useState` without the
 * bar knowing the difference.
 *
 * Three things are worth knowing before editing it.
 *
 * Each segment owns a **Base UI `Popover`** rather than the bar sharing one
 * portal. Base UI does the positioning, the collision flipping, the outside
 * press, Escape and the focus return — and it resolves `align="start"` and
 * `side` logically, so the menus land correctly under a right-to-left `dir`
 * with nothing here to flip by hand. A shared portal would also have to track
 * which segment it is anchored to, and an anchor that unmounts while open (the
 * chip was just removed) takes the popup's position with it.
 *
 * Async values are fetched **from the handler that opens the menu**, never
 * from an effect — `react-hooks/set-state-in-effect` is an error here, and
 * opening a menu is always something a person did. A stale response cannot
 * overwrite a newer one: every fetch carries a sequence number and a reply
 * that is not the newest is dropped rather than rendered.
 *
 * Arrow keys move between segments by a **roving tabindex**, so the whole bar
 * is one tab stop however many filters are on it. The focused key is state
 * rather than a ref because it is read during render to decide `tabIndex`.
 */
export function FilterBar({
  fields,
  value,
  onChange,
  labels,
  clear,
  leading,
  trailing,
  disabled,
  compactAdd,
  className,
  "aria-label": ariaLabel,
}: FilterBarProps) {
  const reduced = useSafeReducedMotion()
  const [open, setOpen] = React.useState<OpenState>(null)
  const [flashId, setFlashId] = React.useState<string | null>(null)
  const [asyncState, setAsyncState] = React.useState<
    Record<string, AsyncState>
  >({})

  const barRef = React.useRef<HTMLDivElement>(null)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])
  const requests = React.useRef(new Map<string, number>())

  React.useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer)
    },
    [],
  )

  /* -- focus order ------------------------------------------------------- */

  /**
   * A field already on the bar is not offered a second time, and the add
   * button goes away once every field is in use.
   *
   * One chip per field is the model every screen here is built on: a field id
   * *is* the query argument it writes. A second chip on the same field could
   * only ever be ignored by the mapping — it would sit there rendering a
   * chosen value the list is not filtering by, which is worse than not
   * offering it. A chip's own field menu still lists its current field, so
   * changing a field is never blocked by the chip doing the changing.
   */
  const usedFields = new Set(value.map((f) => f.field))
  const canAdd = fields.some((f) => !usedFields.has(f.id))

  const fieldItemsFor = (current?: string): MenuItem[] =>
    fields
      .filter((f) => f.id === current || !usedFields.has(f.id))
      .map((f) => ({ value: f.id, label: f.label, glyph: f.icon }))

  const focusKeys: string[] = []
  for (const filter of value) {
    const field = fieldById(fields, filter.field)
    focusKeys.push(`${filter.id}:field`)
    if ((field?.operators.length ?? 0) > 1)
      focusKeys.push(`${filter.id}:operator`)
    focusKeys.push(`${filter.id}:value`, `${filter.id}:remove`)
  }
  if (canAdd) focusKeys.push("add")

  const [focusKey, setFocusKey] = React.useState("add")
  // Adjusted during render rather than in an effect: the key stops existing in
  // the same commit that removes its chip, and an effect would leave one frame
  // in which nothing on the bar is tabbable.
  if (focusKeys.length > 0 && !focusKeys.includes(focusKey))
    setFocusKey(focusKeys[focusKeys.length - 1]!)

  /**
   * Segments are addressed by `data-focus-key` rather than through a ref map.
   * Registering one would mean building a ref callback per segment in the
   * render body, and `react-hooks/refs` rightly refuses a ref handed to a
   * function during render; this reads the DOM only from an event handler.
   */
  const focusAt = (index: number) => {
    if (focusKeys.length === 0) return
    const key = focusKeys[Math.max(0, Math.min(index, focusKeys.length - 1))]!
    setFocusKey(key)
    barRef.current
      ?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)
      ?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // While a menu is open the arrow keys belong to its list.
    if (open) return
    // Only the bar's own segments rove. `leading` and `trailing` hold whatever
    // the screen put in them — a search box, a Reset button — and a key press
    // inside a text field is caret movement, not navigation: without this the
    // bar swallowed Arrow/Home/End from a nested input and threw focus onto
    // the add button mid-word.
    const target = event.target as Element | null
    if (!target?.closest?.("[data-focus-key]")) return
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault()
      // The bar is laid out in writing order, so "next" follows the script:
      // in Arabic the leftward arrow is the one that moves forward.
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
      const forward = (event.key === "ArrowRight") !== rtl
      const at = focusKeys.indexOf(focusKey)
      const next =
        (at + (forward ? 1 : -1) + focusKeys.length) % focusKeys.length
      focusAt(next)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusAt(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusAt(focusKeys.length - 1)
    }
  }

  /* -- option loading ---------------------------------------------------- */

  const loadOptions = React.useCallback(
    (field: FilterFieldDef, query: string) => {
      if (!field.loadOptions) return
      const seq = (requests.current.get(field.id) ?? 0) + 1
      requests.current.set(field.id, seq)

      setAsyncState((state) => ({
        ...state,
        [field.id]: {
          loading: true,
          error: false,
          // Keep what is already on screen: a list that empties on every
          // keystroke flickers between answers.
          options: state[field.id]?.options ?? [],
        },
      }))

      const settle = (next: Omit<AsyncState, "loading">) => {
        // A reply that is not the newest answers a query nobody is typing now.
        if (requests.current.get(field.id) !== seq) return
        setAsyncState((state) => ({
          ...state,
          [field.id]: { loading: false, ...next },
        }))
      }

      field
        .loadOptions(query)
        .then((options) => settle({ error: false, options }))
        .catch(() => settle({ error: true, options: [] }))
    },
    [],
  )

  /** Debounced: only the last keystroke should reach the server. */
  const queryOptions = (field: FilterFieldDef, query: string) => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = [setTimeout(() => loadOptions(field, query), 250)]
  }

  /* -- edits ------------------------------------------------------------- */

  const openMenu = (next: OpenState) => {
    setOpen(next)
    if (next?.kind !== "value") return
    const filter = value.find((f) => f.id === next.filterId)
    const field = fieldById(fields, filter?.field ?? "")
    if (field?.loadOptions && !asyncState[field.id]) loadOptions(field, "")
  }

  const addFilter = (fieldId: string) => {
    const field = fieldById(fields, fieldId)
    // The menu already hides a field that is on the bar; this is the guard for
    // a caller driving the same id in twice.
    if (!field || usedFields.has(fieldId)) return
    const filter: Filter = {
      id: uid(),
      field: fieldId,
      operator: field.operators[0]?.value ?? "is",
      values: [],
    }
    onChange([...value, filter])
    // A chip with no value narrows nothing, so the values menu opens straight
    // away rather than asking for a second click to do the only useful thing.
    setOpen({ kind: "value", filterId: filter.id })
    if (field.loadOptions && !asyncState[field.id]) loadOptions(field, "")
  }

  const changeField = (filterId: string, fieldId: string) => {
    const field = fieldById(fields, fieldId)
    onChange(
      value.map((f) =>
        f.id === filterId
          ? {
              ...f,
              field: fieldId,
              operator: field?.operators[0]?.value ?? f.operator,
              // The old values belonged to the old field.
              values: [],
            }
          : f,
      ),
    )
    setOpen({ kind: "value", filterId })
    if (field?.loadOptions && !asyncState[field.id]) loadOptions(field, "")
  }

  const changeOperator = (filterId: string, operator: string) => {
    const filter = value.find((f) => f.id === filterId)
    const field = fieldById(fields, filter?.field ?? "")
    const next = operatorByValue(field, operator)
    onChange(
      value.map((f) =>
        f.id === filterId
          ? {
              ...f,
              operator,
              // Narrowing to a single-value operator keeps the first choice
              // rather than silently applying several through an "is".
              values: next?.multi ? f.values : f.values.slice(0, 1),
            }
          : f,
      ),
    )
    setOpen(null)
  }

  const commitValues = (filterId: string, next: string[]) => {
    onChange(
      value.map((f) => (f.id === filterId ? { ...f, values: next } : f)),
    )
    setOpen(null)
  }

  const toggleValue = (filterId: string, option: string, multi: boolean) => {
    onChange(
      value.map((f) => {
        if (f.id !== filterId) return f
        if (!multi) return { ...f, values: [option] }
        return {
          ...f,
          values: f.values.includes(option)
            ? f.values.filter((v) => v !== option)
            : [...f.values, option],
        }
      }),
    )
    if (multi) {
      // A multi-select menu stays open over its own chip, so the pulse behind
      // it is the only thing that can say the click registered.
      setFlashId(filterId)
      timers.current.push(
        setTimeout(
          () =>
            setFlashId((current) => (current === filterId ? null : current)),
          450,
        ),
      )
    } else {
      setOpen(null)
    }
  }

  const removeFilter = (filterId: string) => {
    const at = focusKeys.indexOf(`${filterId}:field`)
    onChange(value.filter((f) => f.id !== filterId))
    setOpen(null)
    focusAt(Math.max(0, at - 1))
  }

  /**
   * The housekeeping stays here whoever owns the clearing: the open menu has
   * to close and focus has to land somewhere that still exists, and a screen
   * passing `clear` has no way to do either.
   */
  const clearAll = () => {
    if (clear) clear.onClear()
    else onChange([])
    setOpen(null)
    setFocusKey("add")
  }

  /* -- render ------------------------------------------------------------ */

  const transition: Transition = reduced
    ? { duration: 0 }
    : { type: "spring", stiffness: 560, damping: 34, mass: 0.7 }

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      data-slot="filter-bar"
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {leading}

      <AnimatePresence initial={false} mode="popLayout">
        {value.map((filter) => {
          const field = fieldById(fields, filter.field)
          const operator = operatorByValue(field, filter.operator)
          const multi = operator?.multi ?? false
          const async = field?.loadOptions
            ? (asyncState[field.id] ?? EMPTY_ASYNC)
            : undefined
          const options = async ? async.options : field?.options
          const summary = summarize(
            options,
            filter.values,
            labels.selectValue,
            field?.labelForValue,
          )
          const fieldLabel = field?.label ?? filter.field

          return (
            <motion.div
              key={filter.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              transition={transition}
              className="flex items-stretch overflow-hidden rounded-md border border-border bg-muted/60"
            >
              <Popover
                open={open?.kind === "field" && open.filterId === filter.id}
                onOpenChange={(next) =>
                  openMenu(next ? { kind: "field", filterId: filter.id } : null)
                }
              >
                <PopoverTrigger
                  render={
                    <Segment
                      part="field"
                      data-focus-key={`${filter.id}:field`}
                      tabIndex={focusKey === `${filter.id}:field` ? 0 : -1}
                      onFocus={() => setFocusKey(`${filter.id}:field`)}
                      aria-label={labels.editField(fieldLabel)}
                    >
                      {field?.icon && (
                        <span className="text-muted-foreground" aria-hidden>
                          {field.icon}
                        </span>
                      )}
                      {fieldLabel}
                    </Segment>
                  }
                />
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-56 gap-0 p-0"
                >
                  <OptionMenu
                    items={fieldItemsFor(filter.field)}
                    multi={false}
                    labels={labels}
                    searchable={fields.length > 6}
                    onPick={(id) => changeField(filter.id, id)}
                  />
                </PopoverContent>
              </Popover>

              <Divider />

              {(field?.operators.length ?? 0) > 1 ? (
                <Popover
                  open={
                    open?.kind === "operator" && open.filterId === filter.id
                  }
                  onOpenChange={(next) =>
                    openMenu(
                      next ? { kind: "operator", filterId: filter.id } : null,
                    )
                  }
                >
                  <PopoverTrigger
                    render={
                      <Segment
                        part="operator"
                        muted
                        data-focus-key={`${filter.id}:operator`}
                        tabIndex={focusKey === `${filter.id}:operator` ? 0 : -1}
                        onFocus={() => setFocusKey(`${filter.id}:operator`)}
                        aria-label={labels.editOperator(fieldLabel)}
                      >
                        {operator?.label ?? filter.operator}
                      </Segment>
                    }
                  />
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-48 gap-0 p-0"
                  >
                    <OptionMenu
                      items={(field?.operators ?? []).map((o) => ({
                        value: o.value,
                        label: o.label,
                        selected: o.value === filter.operator,
                      }))}
                      multi={false}
                      searchable={false}
                      labels={labels}
                      onPick={(next) => changeOperator(filter.id, next)}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <StaticSegment>
                  {operator?.label ?? filter.operator}
                </StaticSegment>
              )}

              <Divider />

              <Popover
                open={open?.kind === "value" && open.filterId === filter.id}
                onOpenChange={(next) =>
                  openMenu(next ? { kind: "value", filterId: filter.id } : null)
                }
              >
                <PopoverTrigger
                  render={
                    <Segment
                      part="value"
                      flash={flashId === filter.id}
                      data-focus-key={`${filter.id}:value`}
                      tabIndex={focusKey === `${filter.id}:value` ? 0 : -1}
                      onFocus={() => setFocusKey(`${filter.id}:value`)}
                      aria-label={labels.editValue(fieldLabel, summary.text)}
                    >
                      {summary.glyphs.length > 0 && (
                        <span
                          className="flex shrink-0 items-center gap-0.5"
                          aria-hidden
                        >
                          {summary.glyphs.map((glyph, i) => (
                            <span key={i} className="flex items-center">
                              {glyph}
                            </span>
                          ))}
                        </span>
                      )}
                      <span
                        className={cn(
                          "max-w-48 truncate",
                          summary.empty
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {summary.text}
                      </span>
                    </Segment>
                  }
                />
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className={cn(
                    "gap-0 p-0",
                    field?.valueExtra ? "w-auto min-w-60" : "w-60",
                  )}
                >
                  <OptionMenu
                    items={(options ?? []).map((o) => ({
                      value: o.value,
                      label: o.label,
                      glyph: o.glyph,
                      hint: o.hint,
                      selected: filter.values.includes(o.value),
                    }))}
                    multi={multi}
                    labels={labels}
                    async={async}
                    note={
                      field?.hintNote &&
                      options?.some((o) => o.hint != null)
                        ? field.hintNote
                        : undefined
                    }
                    onQuery={
                      field?.loadOptions
                        ? (query) => queryOptions(field, query)
                        : undefined
                    }
                    onRetry={
                      field?.loadOptions
                        ? () => loadOptions(field, "")
                        : undefined
                    }
                    onPick={(option) => toggleValue(filter.id, option, multi)}
                  />
                  {field?.valueExtra?.({
                    values: filter.values,
                    commit: (next) => commitValues(filter.id, next),
                  })}
                </PopoverContent>
              </Popover>

              <button
                type="button"
                data-focus-key={`${filter.id}:remove`}
                tabIndex={focusKey === `${filter.id}:remove` ? 0 : -1}
                onFocus={() => setFocusKey(`${filter.id}:remove`)}
                onClick={() => removeFilter(filter.id)}
                aria-label={labels.remove(fieldLabel)}
                className="flex items-center rounded-e-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon className="size-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Gone once every field is on the bar — an add menu with nothing left
          to offer is a dead end. */}
      {canAdd && (
        <Popover
          open={open?.kind === "add"}
          onOpenChange={(next) => openMenu(next ? { kind: "add" } : null)}
        >
          <PopoverTrigger
            render={
              <button
                type="button"
                data-focus-key="add"
                tabIndex={focusKey === "add" ? 0 : -1}
                onFocus={() => setFocusKey("add")}
                aria-haspopup="listbox"
                aria-label={value.length === 0 ? labels.empty : labels.add}
                className={cn(
                  "flex items-center text-sm leading-none font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  compactAdd
                    ? "size-7 justify-center rounded-md"
                    : "gap-1 rounded-md border border-dashed border-input px-2 py-1.5 hover:border-ring/40",
                )}
              >
                <PlusIcon className="size-3.5" />
                {!compactAdd &&
                  (value.length === 0 ? labels.empty : labels.add)}
              </button>
            }
          />
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-56 gap-0 p-0"
          >
            <OptionMenu
              items={fieldItemsFor()}
              multi={false}
              labels={labels}
              searchable={fields.length > 6}
              onPick={addFilter}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* One filter is removed by its own X; the shortcut earns its place from
          two — unless the screen owns the button, in which case it decides,
          because it is clearing things the bar cannot see. */}
      {(clear?.active ?? value.length > 1) && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md px-2 py-1.5 text-sm leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {clear?.label ?? labels.clear}
        </button>
      )}

      {trailing}
    </div>
  )
}

export default FilterBar
