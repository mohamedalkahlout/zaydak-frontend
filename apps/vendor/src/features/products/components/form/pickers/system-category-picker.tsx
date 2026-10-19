"use client"

import { useMemo, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import type { PopoverRootChangeEventDetails } from "@base-ui/react/popover"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import {
  GET_CATEGORY_ATTRIBUTES,
  GET_SYSTEM_CATEGORIES_FLAT,
  SUGGEST_SYSTEM_CATEGORIES,
  type SystemCategorySuggestion,
  type SystemCategorySuggestionsData,
} from "@/features/products/api"
import { aiErrorKey, plainLine } from "@/features/products/lib/store-import-ai"
import type {
  CategoryAttributesResponse,
  SystemCategoriesFlatResponse,
  SystemCategory,
} from "@/features/products/types"
import { scrollToMetafields } from "@/features/products/lib/form/attribute-values"
import {
  ancestorChain,
  buildCategoryIndex,
} from "@/features/products/lib/form/category-tree"
import type { ProductFormApi } from "@/features/products/validations/product"

const MAX_VISIBLE = 60
const MIN_QUERY_LENGTH = 2

/** The cmdk value of the "Use <name>" row that heads every drilled-in level. */
const parentRowValue = (id: string) => `__use_${id}`

interface SystemCategoryPickerProps {
  form: ProductFormApi
  /** `{ id → breadcrumb }` for the already-chosen node on edit mode. */
  snapshots?: Record<string, string>
  locale?: string
}

/**
 * Shopify-style category selector. Shows the chosen leaf + parent in a
 * combobox button, with a side badge counting the effective metafields
 * so the user knows how much structure they're opting into before they
 * click.
 */
export function SystemCategoryPicker({
  form,
  snapshots = {},
  locale = "en",
}: SystemCategoryPickerProps) {
  const t = useTranslations("products.categoryPicker")
  const [suggest, { loading }] = useMutation<SystemCategorySuggestionsData>(
    SUGGEST_SYSTEM_CATEGORIES,
  )
  const [options, setOptions] = useState<SystemCategorySuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localSnapshots, setLocalSnapshots] = useState<Record<string, string>>({})

  const mergedSnapshots = useMemo(
    () => ({ ...snapshots, ...localSnapshots }),
    [snapshots, localSnapshots],
  )

  const ask = (onSelect: (id: string) => void) => {
    if (loading) return
    setError(null)
    setOptions(null)

    const nameVal = form.getValues
      ? (form.getValues("name") as { en?: string; ar?: string } | string | undefined)
      : undefined
    const productName =
      typeof nameVal === "string"
        ? nameVal
        : (locale === "ar"
            ? nameVal?.ar || nameVal?.en
            : nameVal?.en || nameVal?.ar) || ""

    const descVal = form.getValues
      ? (form.getValues("description") as { en?: string; ar?: string } | string | undefined)
      : undefined
    const productDesc =
      typeof descVal === "string"
        ? descVal
        : (locale === "ar"
            ? descVal?.ar || descVal?.en
            : descVal?.en || descVal?.ar) || ""

    const productBrand =
      (form.getValues ? (form.getValues("brand") as string | undefined) : undefined) || ""

    if (!productName.trim()) return

    void suggest({
      variables: {
        input: {
          products: [
            {
              ref: "product",
              name: productName,
              description: plainLine(productDesc).slice(0, 2000) || undefined,
              brand: productBrand || undefined,
            },
          ],
        },
        locale,
      },
      fetchPolicy: "no-cache",
      onCompleted: (data) => {
        const payload = data?.suggestSystemCategories
        const answer = payload?.data?.find((entry) => entry.ref === "product")
        if (!answer || answer.categories.length === 0) {
          setError(payload?.generated ? t("categoryNoSuggestion") : t("aiFailed"))
          return
        }
        setLocalSnapshots((previous) => ({
          ...previous,
          ...Object.fromEntries(
            answer.categories.map((entry) => [entry.id, entry.label]),
          ),
        }))
        if (answer.decisive) {
          onSelect(answer.categories[0]!.id)
        } else {
          setOptions(answer.categories)
        }
      },
      onError: (err) => {
        const key = aiErrorKey(err)
        setError(key ? t(key) : t("aiFailed"))
      },
    })
  }

  const nameVal = form.watch
    ? (form.watch("name") as { en?: string; ar?: string } | string | undefined)
    : form.getValues
      ? (form.getValues("name") as { en?: string; ar?: string } | string | undefined)
      : undefined

  const hasName =
    nameVal === undefined ||
    Boolean(
      typeof nameVal === "string"
        ? nameVal.trim()
        : nameVal?.en?.trim() || nameVal?.ar?.trim(),
    )

  return (
    <Controller
      control={form.control}
      name="system_category_id"
      render={({ field }) => {
        const selectedId = (field.value as string | undefined) ?? ""
        return (
          <div className="flex flex-col gap-2">
            <SystemCategoryCombobox
              selectedId={selectedId}
              snapshots={mergedSnapshots}
              locale={locale}
              onSelect={(id) => {
                field.onChange(id)
                setOptions(null)
              }}
              onClear={() => {
                field.onChange("")
                setOptions(null)
              }}
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={loading || !hasName}
                aria-busy={loading || undefined}
                onClick={() => ask(field.onChange)}
              >
                {loading ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SparklesIcon />
                )}
                {t("aiSuggest")}
              </Button>

              {options && options.length > 0 && (
                <div
                  role="group"
                  aria-label={t("suggestionsLabel")}
                  className="flex flex-wrap items-center gap-1"
                >
                  {options.map((opt) => (
                    <Button
                      key={opt.id}
                      type="button"
                      size="xs"
                      variant={opt.id === selectedId ? "secondary" : "outline"}
                      className="h-6 text-[11px]"
                      onClick={() => field.onChange(opt.id)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}

              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </div>
        )
      }}
    />
  )
}

interface ComboboxProps {
  selectedId: string
  snapshots: Record<string, string>
  locale: string
  onSelect: (id: string) => void
  onClear: () => void
  /**
   * The product form's furniture around the control: its own label, and the
   * badge counting the chosen category's metafields, which scrolls to them.
   *
   * Off for a caller that supplies its own label and has no metafields card to
   * scroll to — the store-import review screen renders this flush inside a
   * table cell whose first column already names the field. The tree, the
   * search, the drill-down and the keyboard model are the same either way,
   * which is the whole reason this is shared rather than rebuilt.
   */
  chrome?: boolean
}

export function SystemCategoryCombobox({
  selectedId,
  snapshots,
  locale,
  onSelect,
  onClear,
  chrome = true,
}: ComboboxProps) {
  const t = useTranslations("products.categoryPicker")
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")

  /**
   * The level currently on screen, as the chain of nodes drilled through.
   * Empty means the 21 top-level categories.
   */
  const [trail, setTrail] = useState<SystemCategory[]>([])

  /**
   * cmdk's highlighted row, held here rather than left to cmdk so the
   * keyboard can read it (ArrowRight drills whatever is highlighted) and a
   * level change can decide what is highlighted afterwards. Row values are
   * node ids, so `index.byId(active)` is the highlighted node and comes back
   * undefined for the two synthetic rows ("Use <name>", "Clear selection").
   */
  const [active, setActive] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Whether the merchant has moved through the tree since the panel opened.
   *
   * Dismissing commits the level on screen (see `handleOpenChange`), and on an
   * edit the panel opens *already* drilled to the chosen node's parent — so
   * without this, opening the panel to check the current category and clicking
   * away would quietly replace that category with its own parent.
   */
  const [navigated, setNavigated] = useState(false)

  /** Every move through the tree goes through here, so none can forget it. */
  const goTo = (next: SystemCategory[]) => {
    setTrail(next)
    setNavigated(true)
  }

  /**
   * Change level and say which row is highlighted afterwards.
   *
   * cmdk re-selects the first row of a level whenever the highlighted row
   * unmounts and whenever the search text changes, from a re-render it
   * schedules for itself after this one — so a highlight written alongside
   * the level change is overwritten before it is ever painted. It is written
   * from a microtask instead: that runs after React has flushed this event and
   * after cmdk's own re-render, and still before the browser paints, so the
   * row the merchant climbed out of (or the match they jumped to) is what
   * they see highlighted rather than a "Use <parent>" row they never chose.
   * cmdk also scrolls only to highlights it picked itself, so the row is
   * brought into view by hand — after a climb it can be forty rows down a
   * freshly rendered level.
   */
  const moveTo = (next: SystemCategory[], highlight: string) => {
    goTo(next)
    queueMicrotask(() => {
      setActive(highlight)
      scrollRowIntoView(listRef.current, highlight)
    })
  }

  const { data: flatData, loading: flatLoading } =
    useQuery<SystemCategoriesFlatResponse>(GET_SYSTEM_CATEGORIES_FLAT, {
      variables: { locale },
      fetchPolicy: "cache-first",
    })

  // Memoized because five derivations hang off it: a fresh `[]` on every
  // render would rebuild the 5,600-node index each time.
  const nodes = useMemo(
    () => flatData?.systemCategoriesFlat?.data ?? [],
    [flatData],
  )

  // Metafield count for the currently-picked node — drives the header
  // badge next to the label. Skipped when nothing's selected.
  const { data: attrsData } = useQuery<CategoryAttributesResponse>(
    GET_CATEGORY_ATTRIBUTES,
    {
      variables: { systemCategoryId: selectedId, locale },
      skip: !selectedId,
      fetchPolicy: "cache-first",
    },
  )
  const metafieldCount = attrsData?.categoryAttributes?.data?.length ?? 0

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId),
    [nodes, selectedId],
  )
  const parentNode = useMemo(() => {
    if (!selectedNode?.parent_id) return null
    return nodes.find((n) => n.id === selectedNode.parent_id) ?? null
  }, [nodes, selectedNode])

  const index = useMemo(() => buildCategoryIndex(nodes), [nodes])

  // Opening on an edit should land where the merchant left off, not back at
  // the 21 roots: the difference between confirming a choice and finding it
  // again. Adjusted during render rather than from an effect so the popover's
  // first paint is already at the right level.
  const [openedWith, setOpenedWith] = useState<string | null>(null)
  if (open && openedWith !== selectedId) {
    setOpenedWith(selectedId)
    // The chain *to the parent* — so the selected node itself is a row in the
    // list rather than the header, and its siblings are visible beside it.
    setTrail(ancestorChain(index, selectedId).slice(0, -1))
    setNavigated(false)
    // The highlight starts on the chosen row (cmdk falls back to the first
    // row when the value matches nothing), not wherever the last visit left it
    // — a stale id from another level would leave nothing highlighted at all.
    setActive(selectedId)
  }
  if (!open && openedWith !== null) setOpenedWith(null)

  const current = trail.length > 0 ? trail[trail.length - 1] : null
  const level = useMemo(
    () => index.childrenOf(current?.id ?? null),
    [index, current],
  )

  const triggerLabel = selectedNode
    ? parentNode
      ? t("breadcrumb", { leaf: selectedNode.name, parent: parentNode.name })
      : selectedNode.name
    : snapshots[selectedId] || null

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < MIN_QUERY_LENGTH) return []
    const matches: SystemCategory[] = []
    for (const node of nodes) {
      if (matches.length >= MAX_VISIBLE) break
      const name = node.name?.toLowerCase() ?? ""
      const path = node.path?.toLowerCase() ?? ""
      if (name.includes(query) || path.includes(query)) matches.push(node)
    }
    return matches
  }, [nodes, q])

  const searching = q.trim().length >= MIN_QUERY_LENGTH

  const pick = (id: string) => {
    onSelect(id)
    setOpen(false)
    setQ("")
  }

  /** Into a parent's level, landing on its "Use <name>" row. */
  const drillInto = (node: SystemCategory) =>
    moveTo([...trail, node], parentRowValue(node.id))

  /** Up to the level `depth` crumbs deep, landing on the row just left. */
  const climbTo = (depth: number) =>
    moveTo(trail.slice(0, depth), trail[depth].id)

  /**
   * Open a search match's level in place, instead of selecting it.
   *
   * A match is one node with its ancestors printed under it; what it cannot
   * show is what sits *beside* it, which is often the better pick. A parent
   * opens on its own level — its children under the "Use <name>" row, the
   * screen a click-drill would have reached — and a leaf on its parent's,
   * highlighted among its siblings, the same rule an edit-mode open follows.
   * Clearing the box is what hands the screen back to the trail, and going
   * through `goTo` means an outside press then commits this level like any
   * other the merchant navigated to.
   */
  const jumpTo = (node: SystemCategory) => {
    const chain = ancestorChain(index, node.id)
    if (index.hasChildren(node.id)) moveTo(chain, parentRowValue(node.id))
    else moveTo(chain.slice(0, -1), node.id)
    setQ("")
  }

  /**
   * ArrowRight drills the highlighted row and ArrowLeft climbs a level; in a
   * search, ArrowRight opens the highlighted match's level (`jumpTo`). cmdk
   * runs this before its own key handling and skips that when the event is
   * default-prevented; it binds neither key itself.
   *
   * Two rules bound it. The keys are mirrored under `dir="rtl"`, where the
   * drill chevron points left. And they are never stolen from a caret that
   * could still move: with text in the box, the key acts only when the caret
   * is already against the edge it points at, so editing a query is never
   * interrupted by the level changing underneath it.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    const rtl = document.documentElement.dir === "rtl"
    const into = (e.key === "ArrowRight") !== rtl
    if (caretCanMove(e.target, into)) return

    if (into) {
      const node = index.byId(active)
      if (!node) return
      if (searching) jumpTo(node)
      else if (index.hasChildren(node.id)) drillInto(node)
      else return
    } else {
      if (searching || trail.length === 0) return
      climbTo(trail.length - 1)
    }
    e.preventDefault()
  }

  /**
   * Clicking away takes the level on screen as the answer.
   *
   * A merchant who drilled into "Electronics" looking for something more exact
   * and found nothing better has already said which category they mean. Making
   * them find the "Use Electronics" row first spends that navigation and leaves
   * the product uncategorised when they click away instead — which is the
   * outcome this is here to stop. Nothing about the taxonomy asks for a leaf:
   * `system_category_id` is a plain optional id on the server and metafields
   * resolve from the ancestor chain, so a level-1 pick is a smaller schema
   * rather than an invalid one.
   *
   * Three things it deliberately is not. **Escape still cancels** — it is the
   * undo of every other panel in the dashboard, and one that silently wrote a
   * value would be the odd one out. **A search in progress cancels too**: the
   * trail is left standing underneath a query, so the level it names is not
   * what the merchant is looking at. And it does nothing until the merchant has
   * actually navigated, for the reason `navigated` exists.
   */
  const handleOpenChange = (
    next: boolean,
    details: PopoverRootChangeEventDetails,
  ) => {
    if (
      !next &&
      details.reason === "outside-press" &&
      navigated &&
      !searching &&
      current &&
      current.id !== selectedId
    ) {
      onSelect(current.id)
    }
    setOpen(next)
  }

  /** A match's ancestors by name — the same names the levels it opens onto use. */
  const pathOf = (node: SystemCategory) =>
    ancestorChain(index, node.id)
      .slice(0, -1)
      .map((n) => n.name)
      .join(" › ")

  return (
    <div className={cn("flex flex-col", chrome && "gap-1.5")}>
      {chrome && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">{t("label")}</label>
          {selectedId && metafieldCount > 0 && (
            // The count is also the way there. It sits at the top of a long form
            // and the fields it counts — plus whatever the AI has proposed for
            // them — are several cards below, so a label that only reports a
            // number makes the merchant hunt for what it is talking about.
            <Badge
              render={<button type="button" />}
              variant="outline"
              title={t("goToMetafields")}
              onClick={() => scrollToMetafields()}
              className="cursor-pointer gap-1 bg-muted font-normal transition hover:bg-muted-foreground/15"
            >
              {t("metafieldCount", { count: metafieldCount })}
              <ArrowDownIcon className="size-3" />
            </Badge>
          )}
        </div>
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-auto w-full justify-between gap-2 px-3 py-2 text-left font-normal",
                !triggerLabel && "text-muted-foreground",
              )}
            >
              <span className="flex-1 truncate">
                {flatLoading && !triggerLabel
                  ? t("loading")
                  : (triggerLabel ?? t("placeholder"))}
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-96 max-w-[90vw] p-0" align="start">
          <Command
            shouldFilter={false}
            value={active}
            onValueChange={setActive}
            onKeyDown={handleKeyDown}
          >
            <CommandInput
              placeholder={t("searchPlaceholder")}
              value={q}
              onValueChange={setQ}
            />

            {/* Search takes over the list while there is a query; the trail is
                left untouched underneath, so clearing the box returns the
                merchant to the level they were browsing. */}
            {!searching && <CategoryTrail trail={trail} onUp={climbTo} />}

            <CommandList ref={listRef} className="max-h-80">
              {searching ? (
                <SearchResults
                  loading={flatLoading}
                  nodes={filtered}
                  selectedId={selectedId}
                  pathOf={pathOf}
                  onPick={pick}
                  onJump={jumpTo}
                />
              ) : (
                <BrowseLevel
                  loading={flatLoading}
                  nodes={level}
                  current={current}
                  selectedId={selectedId}
                  hasChildren={index.hasChildren}
                  onDrill={drillInto}
                  onPick={pick}
                />
              )}

              {selectedId && (
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onClear()
                    setOpen(false)
                    setQ("")
                  }}
                  className="justify-center text-xs text-muted-foreground"
                >
                  {t("clearSelection")}
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  )
}

/**
 * Whether an arrow key would move the caret if left alone — a selection to
 * collapse, or room before the edge the key points at. `towardEnd` is the
 * logical end of the text: in an RTL box the "into" key is ArrowLeft, and
 * that is also the key that walks the caret to the end of Arabic text, so
 * one rule serves both directions.
 */
function caretCanMove(target: EventTarget, towardEnd: boolean): boolean {
  if (!(target instanceof HTMLInputElement)) return false
  const { selectionStart, selectionEnd, value } = target
  if (selectionStart === null || selectionEnd === null) return false
  if (selectionStart !== selectionEnd) return true
  return towardEnd ? selectionEnd < value.length : selectionStart > 0
}

/**
 * cmdk scrolls to a highlight it chose itself (arrow keys, hover, its
 * first-row fallback) and leaves one written through `value` where it is.
 */
function scrollRowIntoView(list: HTMLElement | null, value: string) {
  const row = Array.from(
    list?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [],
  ).find((el) => el.getAttribute("data-value") === value)
  row?.scrollIntoView({ block: "nearest" })
}

/**
 * Where you are in the tree, and the way back out.
 *
 * Rendered as a row of crumbs rather than a single Back button because a deep
 * category is seven levels down — stepping out one at a time to reach
 * "Apparel & Accessories" is the tax this replaces.
 */
function CategoryTrail({
  trail,
  onUp,
}: {
  trail: SystemCategory[]
  onUp: (depth: number) => void
}) {
  const t = useTranslations("products.categoryPicker")
  if (trail.length === 0) return null

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
      <button
        type="button"
        onClick={() => onUp(trail.length - 1)}
        aria-label={t("backOneLevel")}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4 rtl:rotate-180" />
      </button>
      <button
        type="button"
        onClick={() => onUp(0)}
        className="shrink-0 rounded px-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        {t("all")}
      </button>
      {trail.map((node, depth) => (
        <span key={node.id} className="flex shrink-0 items-center gap-1">
          <ChevronRightIcon className="size-3 text-muted-foreground/60 rtl:rotate-180" />
          <button
            type="button"
            onClick={() => onUp(depth + 1)}
            className={cn(
              "rounded px-1 text-xs transition hover:text-foreground",
              depth === trail.length - 1
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {node.name}
          </button>
        </span>
      ))}
    </div>
  )
}

/**
 * One level of the taxonomy.
 *
 * The rule that makes a click unambiguous: **a row with children drills, a leaf
 * selects.** Doing both from one row is the version of this that assigns
 * "Cosmetics" to a product whose owner was on their way to "Perfume & Cologne".
 * A parent is still selectable — the "Use this category" row at the top of
 * every drilled-in level does it in one deliberate click, which is the right
 * cost for the less common intent.
 */
function BrowseLevel({
  loading,
  nodes,
  current,
  selectedId,
  hasChildren,
  onDrill,
  onPick,
}: {
  loading: boolean
  nodes: SystemCategory[]
  current: SystemCategory | null
  selectedId: string
  hasChildren: (id: string) => boolean
  onDrill: (node: SystemCategory) => void
  onPick: (id: string) => void
}) {
  const t = useTranslations("products.categoryPicker")
  if (loading) return <RowSkeletons />

  return (
    <>
      {current && (
        <CommandItem
          value={parentRowValue(current.id)}
          onSelect={() => onPick(current.id)}
          className="gap-2 border-b border-border text-xs"
        >
          <CheckIcon
            className={cn(
              "size-3.5 shrink-0",
              current.id === selectedId ? "opacity-100" : "opacity-0",
            )}
          />
          <span className="truncate">
            {t.rich("use", {
              name: current.name,
              b: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </span>
        </CommandItem>
      )}

      {nodes.length === 0 ? (
        <CommandEmpty>{t("emptyLevel")}</CommandEmpty>
      ) : (
        nodes.map((node) => {
          const drillable = hasChildren(node.id)
          return (
            <CommandItem
              key={node.id}
              value={node.id}
              onSelect={() => (drillable ? onDrill(node) : onPick(node.id))}
              className={cn(
                "gap-2 py-2",
                node.id === selectedId && "bg-accent",
              )}
            >
              <span className="flex-1 truncate">{node.name}</span>
              {drillable ? (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              ) : (
                node.id === selectedId && (
                  <CheckIcon className="size-4 shrink-0 text-muted-foreground" />
                )
              )}
            </CommandItem>
          )
        })
      )}
    </>
  )
}

/**
 * Flat, path-annotated matches — the escape hatch from browsing.
 *
 * The row selects, as it always has; the chevron at its end opens the match's
 * level instead (`onJump`). It is a button inside the option rather than a
 * second row because the two intents belong to one match, and it stops the
 * click from reaching the row: cmdk binds the option's own click to select,
 * so without that one click would both open the level and choose the match.
 * `tabIndex={-1}` keeps it off the tab order — ArrowRight on the highlighted
 * match is the keyboard's way in.
 */
function SearchResults({
  loading,
  nodes,
  selectedId,
  pathOf,
  onPick,
  onJump,
}: {
  loading: boolean
  nodes: SystemCategory[]
  selectedId: string
  pathOf: (node: SystemCategory) => string
  onPick: (id: string) => void
  onJump: (node: SystemCategory) => void
}) {
  const t = useTranslations("products.categoryPicker")
  if (loading) return <RowSkeletons />
  if (nodes.length === 0) return <CommandEmpty>{t("noMatches")}</CommandEmpty>

  return (
    <>
      {nodes.map((node) => {
        const path = pathOf(node)
        return (
          <CommandItem
            key={node.id}
            value={node.id}
            onSelect={() => onPick(node.id)}
            className={cn("gap-2 py-2", node.id === selectedId && "bg-accent")}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{node.name}</span>
              {path && (
                <span className="truncate text-xs text-muted-foreground">
                  {path}
                </span>
              )}
            </span>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t("browseHere")}
              title={t("browseHere")}
              onClick={(e) => {
                e.stopPropagation()
                onJump(node)
              }}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted-foreground/15 hover:text-foreground"
            >
              <ChevronRightIcon className="size-4 rtl:rotate-180" />
            </button>
          </CommandItem>
        )
      })}
    </>
  )
}

function RowSkeletons() {
  return (
    <div className="flex flex-col gap-1 p-1">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-full" />
    </div>
  )
}
