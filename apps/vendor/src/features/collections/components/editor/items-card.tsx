"use client"

import { useState } from "react"
import Image from "@/shared/components/app-image"
import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  Columns3Icon,
  LayoutGridIcon,
  ListFilterIcon,
  ListIcon,
  PackagePlusIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents, translatable } from "@/shared/lib/format"
import { validationMessage } from "@/shared/lib/validation-errors"
import type { CollectionItem } from "@/features/collections/types"
import {
  MAX_TOTAL_CONDITIONS,
  countConditions,
  type CollectionFormApi,
  type CollectionSort,
  type SourceInput,
} from "@/features/collections/validations/shop-collection"
import { useCollectionPreview } from "./use-collection-preview"

const SORTS: CollectionSort[] = [
  "MOST_RELEVANT",
  "BEST_SELLING",
  "TITLE_ASC",
  "TITLE_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
  "CREATED_DESC",
  "CREATED_ASC",
  "MANUAL",
]

const DEFAULT_SORT: CollectionSort = "MOST_RELEVANT"
const COLUMN_CHOICES = [3, 4, 5, 6]
const PAGE_SIZE = 24

/**
 * The collection as it will exist — matched live from the staged rules, so a
 * condition can be judged before it is saved. Removing an item here does the
 * thing that actually keeps it out: un-picks a hand-picked product, and
 * excludes one a condition matched.
 *
 * The empty state is the skeleton itself rather than an icon and a sentence:
 * an unpopulated collection is one *waiting* for a rule, and drawing the shape
 * it is about to take says that better than a package glyph. The sentence that
 * would have carried it sits beside the title instead, where it also reads
 * while the first query is still in flight — which is why loading and empty
 * deliberately render the same thing.
 */
export function ItemsCard({
  form,
  onRemoveItem,
  onAddCondition,
  onAddProducts,
}: {
  form: CollectionFormApi
  onRemoveItem: (item: CollectionItem) => void
  onAddCondition: () => void
  onAddProducts: () => void
}) {
  const t = useTranslations("collections")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [columns, setColumns] = useState(4)
  const [page, setPage] = useState(1)

  const sort = useWatch({ control: form.control, name: "sort" })
  const sources = (useWatch({ control: form.control, name: "sources" }) ??
    []) as SourceInput[]
  const { items, total, totalPages, loading, refreshing, error } =
    useCollectionPreview({ form, page, limit: PAGE_SIZE })

  // The empty state's shortcut spends the same 60-condition budget the sources
  // panel gates, so it goes quiet at the same line rather than clicking dead.
  const canAddCondition = countConditions(sources) < MAX_TOTAL_CONDITIONS

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const empty = items.length === 0
  const sorted = sort !== DEFAULT_SORT

  const setSort = (value: CollectionSort) => {
    form.setValue("sort", value, { shouldDirty: true })
    setPage(1)
  }

  return (
    <div className="rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* The card's header, on the card's own white: the count and the hint
          describe the collection, and everything that operates on the items
          sits below on a recessed panel. One surface change is what separates
          "what this is" from "what is in it". */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{t("items.title")}</h2>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {empty ? t("items.hint") : t("items.showing", { from, to, total })}
        </p>
      </div>

      {/* Solid `bg-muted`, not a translucent tint: the empty state's radial
          wash fades to `var(--muted)`, and a surface blended against the card
          would leave a visible disc where the two fail to meet. Everything
          drawn inside therefore takes its contrast from `bg-card` — a muted
          control on a muted panel is not a control at all. */}
      <div className="rounded-lg border bg-muted p-2.5">
        <div className="flex items-center gap-2 pb-2.5">
          {/* One recessed tray, one raised face: the active view is the only
              control in the group carrying the button ledge, so which mode is
              on is legible without a colour anyone has to learn. The tray is
              `bg-background` rather than `bg-muted` because the panel under it
              is already muted — the recess has to go a step darker to stay a
              recess, and it does so in both themes. */}
          <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-background p-0.5">
            <ViewButton
              active={view === "grid"}
              label={t("items.grid")}
              onClick={() => setView("grid")}
            >
              <LayoutGridIcon className="size-3.5" />
            </ViewButton>
            <ViewButton
              active={view === "list"}
              label={t("items.list")}
              onClick={() => setView("list")}
            >
              <ListIcon className="size-3.5" />
            </ViewButton>
          </div>

          {view === "grid" && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(p) => (
                  <Button
                    {...p}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 px-2 tabular-nums"
                    aria-label={`${t("items.columns")}: ${columns}`}
                  >
                    <Columns3Icon className="size-3.5 text-muted-foreground" />
                    {columns}
                  </Button>
                )}
              />
              <DropdownMenuContent align="start" className="w-auto min-w-36">
                <DropdownMenuRadioGroup
                  value={String(columns)}
                  onValueChange={(value) => setColumns(Number(value))}
                >
                  {COLUMN_CHOICES.map((count) => (
                    <DropdownMenuRadioItem key={count} value={String(count)}>
                      {t("items.columnsCount", { count })}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="ms-auto flex items-center gap-2">
            {refreshing && !loading && (
              <span className="text-[11px] text-muted-foreground">
                {t("items.unsavedPreview")}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(p) => (
                  <Button
                    {...p}
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("items.sortLabel")}
                  >
                    <ListFilterIcon className="size-3.5" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end" className="w-auto min-w-44">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => setSort(value as CollectionSort)}
                >
                  {SORTS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {t(`sort.${option}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* The chip is what the sort button did, spelled out. It appears only
            once the sort leaves its default, so the row is never chrome that
            says nothing. */}
        {sorted && (
          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-card py-1 ps-2.5 pe-1 text-xs">
              {t("items.sortLabel")}: {t(`sort.${sort}`)}
              <button
                type="button"
                aria-label={t("items.resetSort")}
                onClick={() => setSort(DEFAULT_SORT)}
                className="rounded-md p-0.5 text-muted-foreground transition hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setSort(DEFAULT_SORT)}
            >
              {t("items.clearAll")}
            </Button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-2.5 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertCircleIcon className="size-4 shrink-0" />
            <p className="flex-1 font-medium">
              {validationMessage(error, t("items.previewError"))}
            </p>
          </div>
        )}

        <div
          className={cn(
            refreshing && !loading && "opacity-70 transition-opacity",
          )}
        >
          {empty ? (
            <EmptyState
              view={view}
              columns={columns}
              label={loading ? t("items.loading") : t("items.hint")}
              canAddCondition={canAddCondition}
              onAddCondition={onAddCondition}
              onAddProducts={onAddProducts}
            />
          ) : view === "grid" ? (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {items.map((item) => (
                <ItemTile key={item.id} item={item} onRemove={onRemoveItem} />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <ItemRow key={item.id} item={item} onRemove={onRemoveItem} />
              ))}
            </ul>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="-mx-2.5 -mb-2.5 mt-2.5 flex items-center justify-between rounded-b-lg border-t px-2.5 py-2">
            <p className="text-xs text-muted-foreground">
              {t("items.showing", { from, to, total })}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="size-3.5 rtl:rotate-180" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRightIcon className="size-3.5 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size="icon-sm"
      aria-pressed={active}
      aria-label={label}
      className={cn(
        !active && "text-muted-foreground hover:bg-card/60 dark:hover:bg-card/50",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ItemTile({
  item,
  onRemove,
}: {
  item: CollectionItem
  onRemove: (item: CollectionItem) => void
}) {
  const t = useTranslations("collections")
  const name = translatable(item.name)
  const thumb = item.image?.thumbnail ?? item.image?.original
  const price = item.sale_price_cents ?? item.price_cents

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-card">
        {thumb ? (
          <Image
            src={thumb}
            alt={name}
            fill
            sizes="200px"
            className="object-cover"
            unoptimized
          />
        ) : null}
        <RemoveButton item={item} onRemove={onRemove} />
        {item.pinned && (
          <span className="absolute bottom-1 start-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
            {t("items.pinned")}
          </span>
        )}
      </div>
      <p className="truncate text-xs font-medium">{name || item.slug}</p>
      <p className="text-[11px] text-muted-foreground">
        {formatMoneyCents(price)}
        {!item.in_stock ? ` · ${t("items.outOfStock")}` : ""}
      </p>
    </div>
  )
}

function ItemRow({
  item,
  onRemove,
}: {
  item: CollectionItem
  onRemove: (item: CollectionItem) => void
}) {
  const t = useTranslations("collections")
  const name = translatable(item.name)
  const thumb = item.image?.thumbnail ?? item.image?.original
  const price = item.sale_price_cents ?? item.price_cents

  return (
    <li className="group flex items-center gap-3 py-2">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-card">
        {thumb ? (
          <Image
            src={thumb}
            alt={name}
            width={40}
            height={40}
            className="size-10 object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name || item.slug}</p>
        <p className="text-xs text-muted-foreground">
          {formatMoneyCents(price)}
          {item.pinned ? ` · ${t("items.pinned")}` : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="opacity-0 transition group-hover:opacity-100"
        aria-label={item.pinned ? t("items.remove") : t("items.exclude")}
        onClick={() => onRemove(item)}
      >
        <XIcon className="size-3.5" />
      </Button>
    </li>
  )
}

function RemoveButton({
  item,
  onRemove,
}: {
  item: CollectionItem
  onRemove: (item: CollectionItem) => void
}) {
  const t = useTranslations("collections")
  return (
    <button
      type="button"
      aria-label={item.pinned ? t("items.remove") : t("items.exclude")}
      onClick={() => onRemove(item)}
      className="absolute end-1 top-1 rounded-md bg-background/90 p-1 opacity-0 transition hover:text-destructive group-hover:opacity-100"
    >
      <XIcon className="size-3.5" />
    </button>
  )
}

/**
 * The skeleton, plus the two ways out of it. The actions stay out of the way
 * until the pointer arrives — an empty collection is not a broken one, so the
 * panel should not open with a demand — and the wash under them is a radial
 * fade of the recessed panel's own surface (`--muted`, which is why that panel
 * is not a translucent tint), dissolving the middle of the grid instead of
 * dropping a scrim over it. The buttons are `outline` rather than `secondary`
 * because `--secondary` and `--muted` are the same value: on this panel a
 * secondary button would have no face at all.
 */
function EmptyState({
  view,
  columns,
  label,
  canAddCondition,
  onAddCondition,
  onAddProducts,
}: {
  view: "grid" | "list"
  columns: number
  label: string
  canAddCondition: boolean
  onAddCondition: () => void
  onAddProducts: () => void
}) {
  const t = useTranslations("collections.sources")
  return (
    <div className="group/empty relative">
      <ItemsSkeleton view={view} columns={columns} label={label} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(60%_55%_at_50%_50%,var(--muted)_0%,var(--muted)_42%,transparent_78%)] opacity-0 transition-opacity duration-300 group-hover/empty:opacity-100 group-focus-within/empty:opacity-100"
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 transition duration-200 group-hover/empty:pointer-events-auto group-hover/empty:opacity-100 group-focus-within/empty:pointer-events-auto group-focus-within/empty:opacity-100">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!canAddCondition}
          onClick={onAddCondition}
        >
          <CirclePlusIcon className="size-4 text-muted-foreground" />
          {t("addCondition")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onAddProducts}
        >
          <PackagePlusIcon className="size-4 text-muted-foreground" />
          {t("addProducts")}
        </Button>
      </div>
    </div>
  )
}

/**
 * Both the first paint and the empty collection. The pulse is staggered per
 * tile so the panel reads as one thing settling rather than every card
 * flashing on the same beat.
 */
function ItemsSkeleton({
  view,
  columns,
  label,
}: {
  view: "grid" | "list"
  columns: number
  label: string
}) {
  if (view === "list") {
    return (
      <ul role="status" aria-label={label} className="flex flex-col gap-2 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-xl bg-card/60 p-2"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="size-10 shrink-0 rounded-lg bg-card" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-2.5 w-1/3 rounded-full bg-card" />
              <div className="h-2.5 w-1/5 rounded-full bg-card" />
            </div>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-3 py-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns * 2 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-2 rounded-xl bg-card/60 p-2"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <div className="aspect-square w-full rounded-lg bg-card" />
          <div className="h-2.5 w-3/4 rounded-full bg-card" />
          <div className="h-2.5 w-1/2 rounded-full bg-card" />
        </div>
      ))}
    </div>
  )
}
