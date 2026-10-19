"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { motion } from "motion/react"
import {
  GlobeIcon,
  ImageIcon,
  InfoIcon,
  LogOutIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@repo/ui/lib/utils"
import AppImage from "@/shared/components/app-image"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { useSheetGesture } from "@/shared/hooks/use-sheet-gesture"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import {
  GET_STORE_IMPORT_JOB,
  GET_STORE_IMPORT_PRODUCTS,
  SAVE_STORE_IMPORT_OVERRIDES,
  type SaveStoreImportOverridesData,
  type StoreImportJobData,
  type StoreImportProduct,
  type StoreImportProductsData,
} from "@/features/products/api"
import { storeImportErrorKey } from "@/features/products/lib/store-import"
import {
  FIELD_GROUPS,
  editedDisplay,
  fieldsByGroup,
  importedDisplay,
  importedText,
  isCleared,
  isDirty,
  isExcluded,
  primaryImage,
  productTitle,
  referenceDisplay,
  rowRuns,
  scannedDisplay,
  stageExcluded,
  stageField,
  stageImageDropped,
  stageImageOrder,
  stageRevert,
  toPatches,
  type ReviewDraft,
} from "@/features/products/lib/store-import-review"
import { aiActionsFor } from "@/features/products/lib/store-import-ai"
import { AiCategoryFillDialog } from "./ai-category-fill-dialog"
import { BulkFillDialog } from "./bulk-fill-dialog"
import { CategoryCell } from "./category-cell"
import { FieldDiffHeader, FieldDiffRow, NeedsAttentionBadge } from "./field-diff-row"
import { ReviewImageStrip } from "./review-image-strip"
import { ReviewRail } from "./review-rail"
import { useStoreImportAi, type StoreImportAi } from "./use-store-import-ai"

/**
 * Review and edit a scanned catalogue, before a single product is written.
 *
 * The shape is Shopify's Translate & Adapt, and since 2026-09-15 the frame is
 * too: the screen is drawn as a **sheet over the dashboard**, the same
 * `top-(--header-height)` band the settings overlay uses, with its own title
 * bar (name, X), its own toolbar (exit, search, Discard/Save) and no app
 * sidebar — a rail of items on the left, one item's fields on the right. A
 * merchant reviewing two hundred products wants the width the sidebar takes,
 * and a Save that sits where the reference puts it.
 *
 * What it is actually for is different from translation, and the field list
 * says so — **every scanned product arrives with no stock and no category**,
 * because no connector can see a warehouse or guess a taxonomy. So most empty
 * cells here are the reason a migrated catalogue cannot be sold until somebody
 * visits it. The one card that *is* translation is the Arabic one: title and
 * description against the English they translate.
 *
 * Decisions worth knowing before editing this file:
 *
 * **Nothing here writes products.** Save stores the edits beside the scan's own
 * file; the catalogue is still written only by the approval on the progress
 * screen. That is why Save and the approval are on different screens, and why
 * leaving without approving costs a merchant nothing but time.
 *
 * **Save lives in this toolbar, not in the site header's contextual bar.** The
 * bar is the rule for editing screens (`apps/vendor/AGENTS.md`), and it stays
 * mounted above this sheet — but the reference puts Save in the app's own
 * toolbar, and driving both would put two Saves on one screen. The staging
 * model is unchanged: edits are a local draft, dirty is value-based, one
 * mutation sends the whole patch, and `useLeaveGuard` still stops a link, the
 * X, the exit and a reload from dropping it. The theme editor is the precedent
 * for a full-screen tool that owns its own Save.
 *
 * **One draft for the whole job.** Selecting a rail row is local state rather
 * than a route, so a merchant can edit four products and save once, and moving
 * between them never crosses a navigation boundary that could drop staged work.
 *
 * **The editable column starts empty and stays empty.** An input pre-filled
 * with the scanned value reads as the merchant's own answer the moment it
 * appears; keeping the two columns apart is the whole point of the layout.
 */
export function StoreImportReviewEditor({
  jobId,
  shopSlug,
}: {
  jobId: string
  shopSlug: string
}) {
  const t = useTranslations("products.import.review")
  const te = useTranslations("products.import.errors")
  const th = useTranslations("header")
  const tp = useTranslations("products")

  const [draft, setDraft] = useState<ReviewDraft>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [page, setPage] = useState(1)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fillNotice, setFillNotice] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { data, loading, refetch } = useQuery<StoreImportProductsData>(
    GET_STORE_IMPORT_PRODUCTS,
    {
      variables: {
        job_id: jobId,
        page,
        limit: 50,
        only_incomplete: onlyIncomplete,
        search: search.trim() || null,
      },
      // Each filter and page is its own cache entry (the rows carry no id), and
      // a bulk fill changes products on every one of them at once. Cache-first
      // would then show the pre-fill page the moment the merchant toggled the
      // needs-attention filter off — stock they just filled, apparently gone.
      // So a cached view is shown and revalidated rather than trusted.
      fetchPolicy: "cache-and-network",
    },
  )

  const { data: jobData, refetch: refetchJob } = useQuery<StoreImportJobData>(
    GET_STORE_IMPORT_JOB,
    {
      variables: { id: jobId },
      skip: !jobId,
    },
  )
  const expiresAt = jobData?.storeImportJob?.data?.artifact_expires_at

  const [save, { loading: saving }] = useMutation<SaveStoreImportOverridesData>(
    SAVE_STORE_IMPORT_OVERRIDES,
  )

  const result = data?.storeImportProducts
  const products = result?.data ?? []
  const fields = result?.fields ?? []
  const total = result?.meta.total ?? 0

  // Adjust-during-render rather than an effect: `set-state-in-effect` is an
  // error under the React Compiler rules, and the rule's own replacement is to
  // compare against a state value and set during render, so React discards this
  // render instead of committing one frame with a stale selection.
  const [selectionSeededFrom, setSelectionSeededFrom] = useState<string | null>(
    null,
  )
  const firstHandle = products[0]?.handle ?? null
  const pageKey = `${page}:${search}:${onlyIncomplete}`
  if (firstHandle && selectionSeededFrom !== pageKey) {
    setSelectionSeededFrom(pageKey)
    if (!products.some((product) => product.handle === selected)) {
      setSelected(firstHandle)
    }
  }

  const current =
    products.find((product) => product.handle === selected) ?? null
  const dirty = isDirty(draft)

  const onSave = async () => {
    try {
      setSaveError(null)
      setFillNotice(null)
      await save({
        variables: { input: { id: jobId, products: toPatches(draft) } },
      })
      setDraft({})
      await Promise.all([refetch(), refetchJob()])
    } catch (err) {
      const key = storeImportErrorKey(err)
      // A refused value (too long, not an amount, not a whole number) is the
      // merchant's to fix, so it says what to check rather than "try again",
      // which would fail the same way. Handled here, after the shared map,
      // not added to it: a spent plan allowance also arrives as an outer
      // VALIDATION_ERROR, and mapping that code there would hide `planQuota`.
      setSaveError(
        key
          ? te(key)
          : getErrorCode(err) === "VALIDATION_ERROR"
            ? t("saveInvalid")
            : te("generic"),
      )
    }
  }

  const onDiscard = () => {
    setDraft({})
    setSaveError(null)
  }

  // The fill wrote on the server, not into the draft, so the screen re-reads
  // what is saved. Back to page 1 with the selection re-seeded: under the
  // needs-attention filter the products just filled leave the view, and the
  // page the merchant was on may no longer exist.
  const onFilled = async ({
    affected,
    matched,
  }: {
    affected: number
    matched: number
  }) => {
    setSaveError(null)
    setFillNotice(
      [
        t("bulkFill.done", { count: affected }),
        matched > affected
          ? t("bulkFill.doneKept", { count: matched - affected })
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    )
    setPage(1)
    setSelectionSeededFrom(null)
    await Promise.all([refetch({ page: 1 }), refetchJob()])
  }

  const progressHref = `/store/${shopSlug}/products/import/${jobId}`

  // The sheet's entrance and its exit, including the way out.
  //
  // `exit` still goes through the leave guard exactly as it did when it was a
  // bare `router.push` — the hook asks it first — and the only thing that
  // changed is what happens after the merchant says yes: the sheet slides back
  // down, and the navigation fires when it has. See `use-sheet-gesture`.
  const {
    enter,
    phase,
    closing,
    motion: gesture,
    requestExit: exit,
  } = useSheetGesture(progressHref)

  // A staged edit must not be dropped by a link, the header menu or a reload
  // without a word. The screen lives on one URL, so nothing is allowed through.
  useLeaveGuard({
    when: dirty,
    onLeave: () => {
      setDraft({})
      setSaveError(null)
    },
  })

  // Escape closes the sheet (Shopify parity), the same way the settings
  // overlay does. It stands down in four cases, and each one is a control whose
  // own Escape means something else: a dialog (the leave guard's prompt is one,
  // and Escape there means "stay"), the assistant panel open over the sheet, a
  // menu or popover — the row's AI menu and the category picker's tree, where
  // Escape cancels the panel — and a field with focus in it, because on a
  // screen made of inputs Escape from a cell must not throw the merchant off
  // the whole screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (
        document.querySelector(
          "[data-slot=dialog-content], [data-slot=popover-content], [data-slot=dropdown-menu-content]",
        )
      ) {
        return
      }
      if (document.querySelector("#ai-chat-panel:not([inert])")) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable=true]")) return
      exit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressHref])

  const setField = (
    product: StoreImportProduct,
    field: { key: string; kind: string },
    value: string,
  ) => setDraft((previous) => stageField(previous, product, field, value))

  // Revert is its own operation rather than erasing the text: over a stored
  // clear the cell is already empty, and erasing it would stage nothing.
  const setReverted = (
    product: StoreImportProduct,
    field: { key: string; kind: string },
  ) => setDraft((previous) => stageRevert(previous, product, field))

  const setExcluded = (product: StoreImportProduct, excluded: boolean) =>
    setDraft((previous) => stageExcluded(previous, product, excluded))

  const setImageDropped = (
    product: StoreImportProduct,
    url: string,
    dropped: boolean,
  ) =>
    setDraft((previous) => stageImageDropped(previous, product, url, dropped))

  const setImageOrder = (product: StoreImportProduct, order: string[]) =>
    setDraft((previous) => stageImageOrder(previous, product, order))

  // One call in flight for the whole screen. Everything it produces lands in
  // the same draft the merchant types into, so Save, Discard, Revert and the
  // leave guard need to know nothing about it.
  const ai = useStoreImportAi()

  const openSearch = () => {
    setSearchOpen(true)
    // The input mounts on this same commit; focus it once it exists.
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  return (
    <>
      {/* The ground, dimmed. It leads the sheet in by 200ms, which is most of
          why the arrival reads as deliberate rather than as a panel appearing.
          Not click-to-dismiss: this screen holds an unsaved draft, and a stray
          click on a sliver of dashboard must not be a way out of it. */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 bottom-0 top-(--header-height) z-40 bg-foreground/15 dark:bg-black/45"
        variants={gesture.scrim}
        initial={enter ? "below" : false}
        animate={phase}
      />

      {/* The settings overlay's band: under the site header, over the sidebar,
          `z-40` so the assistant panel (`z-45`, keyed off this path too) can
          still open above it. The site header stays, as the reference's global
          bar does, so the shop switcher and the account menu are never lost.
          `inert` while closing: the sheet is on its way out and must not take
          another keystroke into a draft nobody will save. */}
      <motion.div
        inert={closing || undefined}
        className="fixed inset-x-0 bottom-0 top-(--header-height) z-40 flex flex-col overflow-hidden rounded-t-xl bg-background dark:bg-[#1a1a1a]"
        variants={gesture.sheet}
        initial={enter ? "below" : false}
        animate={phase}
      >
        {/* Title bar: the app's name and the way out, like an embedded app's. */}
        <motion.div
          variants={gesture.part}
          className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4"
        >
          <motion.span
            variants={gesture.badge}
            className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <GlobeIcon className="size-3.5" aria-hidden />
          </motion.span>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {t("title")}
          </h1>
          {expiresAt && (
            <span className="hidden text-xs text-muted-foreground md:inline">
              {t("retention", {
                date: new Date(expiresAt).toLocaleDateString(),
              })}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            onClick={exit}
          >
            <XIcon />
          </Button>
        </motion.div>

        {/* Toolbar: exit and the screen's name at the start, the products count
          and the search in the middle, Discard/Save at the end. */}
        <motion.div
          variants={gesture.part}
          className="grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-3 sm:grid-cols-[1fr_auto_1fr]"
        >
          <div className="flex min-w-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("exit")}
              onClick={exit}
            >
              <LogOutIcon className="rtl:-scale-x-100" />
            </Button>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {t("subtitle")}
            </span>
          </div>

          {/* Centred between two equal tracks from `sm`; below that the outer
            tracks are content-sized and this one takes what is left, so an
            open search beside Discard and Save never overflows the bar. */}
          <div className="flex min-w-0 items-center justify-center gap-1">
            <span className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium sm:inline">
              {tp("title")}
              <span className="ms-1.5 text-muted-foreground">{total}</span>
            </span>
            {searchOpen || search ? (
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  onBlur={() => {
                    if (!search.trim()) setSearchOpen(false)
                  }}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className="w-full ps-8 sm:w-64"
                  dir="auto"
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("searchPlaceholder")}
                onClick={openSearch}
              >
                <SearchIcon />
              </Button>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {/* AI categories for the page on screen: an estimate first, then
              one request at a time with a Stop. It stages into the draft, so
              unlike the fill beside it, it works with unsaved edits. Off while
              a row's own AI call runs — one call in flight for the screen. */}
            <AiCategoryFillDialog
              products={products}
              draft={draft}
              fields={fields}
              busy={loading || saving || ai.pending !== null}
              onStage={setDraft}
            />
            {/* The fill for the two fields nothing can scan, over the view on
              screen. Before Discard/Save, and off while there is a draft:
              it writes to the server, and the draft is not there yet. */}
            <BulkFillDialog
              jobId={jobId}
              fields={fields}
              total={total}
              onlyIncomplete={onlyIncomplete}
              search={search}
              dirty={dirty}
              loading={loading || saving}
              onFilled={(result) => void onFilled(result)}
            />
            {dirty && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={onDiscard}
              >
                {th("discard")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saving}
              aria-busy={saving || undefined}
              onClick={() => void onSave()}
            >
              {saving ? th("saving") : th("save")}
            </Button>
          </div>
        </motion.div>

        {/* Every width, and never `display:none`: a hidden `role="alert"` is
          not announced, and the errors that land here are the ones a merchant
          caused by typing — a value past its cap, an unparsable price. */}
        {saveError && (
          <p
            role="alert"
            className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
          >
            {saveError}
          </p>
        )}
        {fillNotice && (
          <div
            role="status"
            className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs text-foreground"
          >
            <p className="min-w-0 flex-1">{fillNotice}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("bulkFill.dismiss")}
              onClick={() => setFillNotice(null)}
            >
              <XIcon />
            </Button>
          </div>
        )}

        {/* The third and last part of the cascade. Deliberately ONE variant
          child, not one per rail row and not one per field card: fifty rows
          arriving in sequence is fifty animations for a gesture nobody asked
          to watch, and it would fight the rail's own scroll. */}
        <motion.div
          variants={gesture.part}
          className="flex min-h-0 flex-1 flex-col lg:flex-row"
        >
          <ReviewRail
            products={products}
            selected={selected}
            draft={draft}
            total={total}
            shown={products.length}
            incompleteTotal={result?.incomplete_total ?? 0}
            onlyIncomplete={onlyIncomplete}
            onOnlyIncomplete={(value) => {
              setOnlyIncomplete(value)
              setPage(1)
            }}
            onSelect={setSelected}
            onToggleExcluded={setExcluded}
            page={result?.meta.page ?? 1}
            totalPages={result?.meta.total_pages ?? 1}
            onPage={setPage}
            loading={loading}
          />

          <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
              {!current ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {loading ? t("loading") : t("noMatches")}
                </p>
              ) : (
                <ProductPane
                  product={current}
                  draft={draft}
                  fields={fields}
                  onField={setField}
                  onRevert={setReverted}
                  onExcluded={setExcluded}
                  onImageDropped={setImageDropped}
                  onImageOrder={setImageOrder}
                  ai={ai}
                />
              )}
            </div>
          </section>
        </motion.div>
      </motion.div>
    </>
  )
}

function ProductPane({
  product,
  draft,
  fields,
  onField,
  onRevert,
  onExcluded,
  onImageDropped,
  onImageOrder,
  ai,
}: {
  product: StoreImportProduct
  draft: ReviewDraft
  fields: StoreImportProductsData["storeImportProducts"]["fields"]
  onField: (
    product: StoreImportProduct,
    field: { key: string; kind: string },
    value: string,
  ) => void
  onRevert: (
    product: StoreImportProduct,
    field: { key: string; kind: string },
  ) => void
  onExcluded: (product: StoreImportProduct, excluded: boolean) => void
  onImageDropped: (
    product: StoreImportProduct,
    url: string,
    dropped: boolean,
  ) => void
  onImageOrder: (product: StoreImportProduct, order: string[]) => void
  ai: StoreImportAi
}) {
  const t = useTranslations("products.import.review")
  const tg = useTranslations("products.import.review.groups")
  const excluded = isExcluded(product, draft)
  // What the product will be imported with, staged drops included — the same
  // rule the server applies, so the header never shows a photo already dropped.
  const thumbnail = primaryImage(product, draft)
  // Each card is a named region: the Arabic card's "Title" is otherwise
  // indistinguishable from the Product card's in a screen reader's field list.
  const headingId = useId()

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Excluding dims the identity — thumbnail and title — and never the
          control that undoes it; a faded checkbox reads as disabled. */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3",
            excluded && "opacity-60",
          )}
        >
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            {thumbnail ? (
              <AppImage
                src={thumbnail}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="truncate text-xl font-semibold tracking-tight"
                dir="auto"
              >
                {productTitle(product, draft)}
              </h2>
              {product.incomplete && !excluded && (
                <NeedsAttentionBadge count={1} />
              )}
            </div>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {product.handle}
            </p>
          </div>
        </div>

        {/* An outline-button-shaped chip around the existing checkbox and
            label pair — a `div`, not a `<label>` around a labelable button. */}
        <div className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5">
          <Checkbox
            id={`exclude-${product.handle}`}
            checked={excluded}
            onCheckedChange={(checked) => onExcluded(product, checked === true)}
          />
          <Label
            htmlFor={`exclude-${product.handle}`}
            className="cursor-pointer text-sm font-normal"
          >
            {t("excludeProduct")}
          </Label>
        </div>
      </div>

      {/* The one place row geometry leaks into the screen, and it has to: on a
          product with variants, row 1's money cells belong to the product AND
          to its first variant, so a price edit here moves that variant too.
          Silence would be a price a merchant did not knowingly change. */}
      {product.shares_variant_row && !excluded && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("variantNote", { count: product.variant_count })}
        </p>
      )}

      {/* The scanned photos first, before the text cards: they are what a
          merchant recognises a product by, and dropping one or choosing the
          main one are the only image edits there are. Hidden while excluded —
          nothing of it is imported. */}
      {!excluded && product.images.length > 0 && (
        <ReviewImageStrip
          product={product}
          draft={draft}
          onDrop={onImageDropped}
          onOrder={onImageOrder}
        />
      )}

      {excluded ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("excludedBody")}
        </div>
      ) : (
        FIELD_GROUPS.map((group) => {
          const groupFields = fieldsByGroup(fields, group)
          if (groupFields.length === 0) return null
          return (
            <section
              key={group}
              aria-labelledby={`${headingId}-${group}`}
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
            >
              <h3
                id={`${headingId}-${group}`}
                className="border-b border-border px-4 py-3 text-base font-semibold"
              >
                {tg(group)}
              </h3>
              {/* `divide-y` draws every hairline between the header and the
                  rows, so no row carries a border of its own. A card mixing
                  ordinary rows with their translations (the search-engine
                  listing) gets a header per run, each naming its own
                  columns. */}
              <div className="divide-y divide-border">
                {rowRuns(groupFields).map((run) => (
                  <Fragment key={run.fields[0].key}>
                    <FieldDiffHeader
                      reference={run.translation ? t("columnEnglish") : undefined}
                      editable={run.translation ? t("columnArabic") : undefined}
                    />
                    {run.fields.map((field) => {
                      const typed = editedDisplay(product, draft, field)
                      // An empty cell that is the merchant's answer, not a blank.
                      const cleared = isCleared(product, draft, field.key)
                      const reference = referenceDisplay(
                        product,
                        draft,
                        field,
                        fields,
                      )
                      const actions = aiActionsFor(field)
                      const cell = `${product.handle}:${field.key}`
                      const stage = (value: string) =>
                        onField(product, field, value)

                      return (
                        <FieldDiffRow
                          key={field.key}
                          field={field}
                          scanned={scannedDisplay(field, product.scanned)}
                          reference={reference}
                          value={typed}
                          cleared={cleared}
                          onChange={stage}
                          onRevert={() => onRevert(product, field)}
                          control={
                            field.kind === "category" ? (
                              <CategoryCell
                                handle={product.handle}
                                value={typed}
                                onChange={stage}
                                // What the product will actually be imported as,
                                // so a title the merchant corrected is the one the
                                // model classifies.
                                productName={importedText(
                                  product,
                                  draft,
                                  fields,
                                  "name_en",
                                )}
                                productDescription={importedText(
                                  product,
                                  draft,
                                  fields,
                                  "description_en",
                                )}
                                productBrand={importedText(
                                  product,
                                  draft,
                                  fields,
                                  "brand",
                                )}
                              />
                            ) : undefined
                          }
                          ai={
                            actions.length === 0
                              ? undefined
                              : {
                                  actions,
                                  running: ai.pending === cell,
                                  busy: ai.pending !== null,
                                  proposal:
                                    ai.proposal?.cell === cell
                                      ? ai.proposal.value
                                      : null,
                                  error:
                                    ai.error?.cell === cell
                                      ? t(ai.error.key)
                                      : null,
                                  deniedReasons: Object.fromEntries(
                                    actions.flatMap((action) => {
                                      const key = ai.deniedKey(action)
                                      return key ? [[action, t(key)]] : []
                                    }),
                                  ),
                                  onRun: (action) =>
                                    ai.run({
                                      product,
                                      field,
                                      action,
                                      // What the cell will import today, which is
                                      // what a rewrite must be based on — nothing,
                                      // for a cell the merchant cleared.
                                      own: importedDisplay(product, draft, field),
                                      reference,
                                      typed,
                                      stage,
                                    }),
                                  onAccept: () => ai.accept(stage),
                                  onDismiss: ai.dismiss,
                                }
                          }
                        />
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
