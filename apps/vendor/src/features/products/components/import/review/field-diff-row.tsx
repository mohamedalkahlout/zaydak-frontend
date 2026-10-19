"use client"

import { useId, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Textarea } from "@repo/ui/components/textarea"
import { Badge } from "@repo/ui/components/badge"
import { cn } from "@repo/ui/lib/utils"
import type { StoreImportField } from "@/features/products/api"
import type { AiAction } from "@/shared/lib/ai-text"
import { plainLine } from "@/features/products/lib/store-import-ai"

/**
 * One row's AI assist, as the row needs to see it.
 *
 * Assembled by the screen — which owns the one call in flight, the draft and
 * the staging — so this component stays presentational and the rule that an
 * answer never overwrites a merchant's words lives in one place rather than in
 * every row.
 */
export interface RowAi {
  /** What this field offers. An empty list means the row renders no control. */
  actions: readonly AiAction[]
  /** A call is running for THIS cell. */
  running: boolean
  /** A call is running somewhere on the screen, so this control stands down. */
  busy: boolean
  /** An answer awaiting a decision, because the cell already had a value. */
  proposal: string | null
  /** An already-localized failure sentence for this cell. */
  error: string | null
  onRun: (action: AiAction) => void
  onAccept: () => void
  onDismiss: () => void
  /** Localized reason an action is disabled. Absent keys are allowed. */
  deniedReasons?: Partial<Record<AiAction, string>>
}

/**
 * The three columns every row and the header share — label, what the scan
 * read, what will be imported — as one constant, so the header can never
 * drift from the rows under it. Tailwind v4's `divide-x` is logical
 * (`border-inline-end`), so the hairlines between cells mirror under RTL with
 * nothing to hand-mirror. Rows collapse to one column below `sm`, where the
 * cells caption themselves instead.
 */
export const REVIEW_GRID =
  "sm:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)_minmax(0,1fr)] sm:divide-x sm:divide-border"

/**
 * The editable cell *is* the field. No border, no radius, flush to the cell
 * edges; the cue that it can be typed into is a faint tint on hover and an
 * inset ring on focus, which is the one signal that survives dark mode, where
 * white-against-grey is a smaller step than it is in light.
 */
const FLUSH_INPUT =
  "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 dark:bg-transparent dark:hover:bg-muted/40"

/**
 * The column names, rendered at the top of every card rather than once for
 * the pane: a header detaches from the rows it labels the moment the pane
 * scrolls past it. Plain text — there is no `role="table"` above it to make
 * a `columnheader` valid, and the rows are labelled by their own `<Label>`s.
 *
 * The translation card names its columns by language ("English" | "Arabic")
 * rather than by provenance, because on that card the reference is not what
 * the scan read but what the Arabic has to say.
 */
export function FieldDiffHeader({
  reference,
  editable,
}: {
  /** Overrides the "what we read" column name. */
  reference?: string
  /** Overrides the "what will be imported" column name. */
  editable?: string
}) {
  const t = useTranslations("products.import.review")
  return (
    <div className={cn("hidden sm:grid", REVIEW_GRID)}>
      <span aria-hidden />
      <span className="px-4 py-2.5 text-sm font-medium">
        {reference ?? t("columnScanned")}
      </span>
      <span className="px-4 py-2.5 text-sm font-medium">
        {editable ?? t("columnImported")}
      </span>
    </div>
  )
}

/**
 * One field, twice: what the scan read, and what will be imported.
 *
 * The shape is Shopify's Translate & Adapt row — a label and caption cell,
 * then a read-only reference cell on a grey ground, then the editable cell —
 * and the reason it is hand-written rather than composed from `Field` is that
 * `Field` mounts one control against one label. Nothing in the kit puts a
 * label against two parallel values, and the app's other two-value control
 * (`translatable-input`) does the opposite on purpose: it mounts a single
 * control and swaps which locale it points at, so focus never jumps.
 *
 * **The editable column starts empty and stays empty until the merchant types.**
 * Pre-filling it with the scanned value would read as a merchant's own answer
 * the moment it appeared, and the whole point of two columns is to keep "what
 * your old store said" and "what you want" visibly apart. An empty cell here
 * means "use what is on the left", which is what the placeholder says.
 *
 * Except when it is a CLEAR (`cleared`): the merchant's answer, staged or
 * saved, is "import nothing here". That cell is empty too, so the row cannot
 * read its state off the text. Everything it says — the tint, Revert, "Needed
 * to sell" — is worked out from what will be imported (the typed value, else
 * nothing for a clear, else the scan), which is the server's own reading.
 *
 * A translation row (`field.reference_key`) is the one where the reference
 * is not this field's own scanned value: it shows the English the Arabic has
 * to match, and, when the enrichment pass already produced an Arabic, that
 * text beneath it under its own caption — so "keep what we read" still means
 * something a merchant can see.
 *
 * A cell that carries the merchant's own value — or their clear — is tinted and
 * grows a Revert; that is the override signal, not a border on the input,
 * because the input has none. The row draws no hairline of its own — the
 * card's `divide-y` does, so the first row never doubles up against the card
 * title's border.
 */
export function FieldDiffRow({
  field,
  scanned,
  reference,
  value,
  cleared,
  onChange,
  onRevert,
  disabled,
  ai,
  control,
}: {
  field: StoreImportField
  /** What the scan read for THIS column. Empty string when it found nothing. */
  scanned: string
  /**
   * What the reference cell shows. Defaults to `scanned`; a translation row
   * passes the English it translates (see `referenceDisplay`).
   */
  reference?: string
  /**
   * What the merchant has typed. Empty means "use the scanned value" — unless
   * the cell is `cleared`.
   */
  value: string
  /** The merchant's staged or saved answer for this cell is a clear. */
  cleared?: boolean
  onChange: (next: string) => void
  /**
   * Put the scan's value back. Erasing the text cannot undo a stored clear —
   * the cell is already empty — so the screen passes its own revert; without
   * one, Revert erases the text.
   */
  onRevert?: () => void
  disabled?: boolean
  /** The row's AI assist. Absent on every field that offers none. */
  ai?: RowAi
  /**
   * Replaces the editable cell's input entirely — the category row's picker.
   * The footer strip (counter, Revert, AI) still renders around it.
   */
  control?: ReactNode
}) {
  const t = useTranslations("products.import.review")
  const tf = useTranslations("products.import.review.fields")

  const id = useId()
  const inputId = `${id}-input`
  const captionId = `${id}-caption`
  const counterId = `${id}-count`
  const describedBy = field.max_length ? `${captionId} ${counterId}` : captionId

  const label = tf(`${field.key}.label`)
  const multiline = field.kind === "multiline"
  const translation = !!field.reference_key
  const shown = translation ? (reference ?? "") : scanned
  // Money is stored in cents and read in major units; integers are counts.
  // Both read left-to-right in tabular figures, and under RTL sit at the
  // label-side edge of their cell so the two columns line up digit for digit.
  const numeric = field.kind === "money_cents" || field.kind === "integer"
  const typed = value.trim() !== ""
  // A clear is the merchant's own answer as much as a typed value is, so it is
  // tinted and can be reverted like one.
  const overridden = typed || !!cleared
  // What the import will carry for this column: the typed value, else nothing
  // for a clear, else the scan — the server's `isIncomplete` reading.
  const imported = typed ? value : cleared ? "" : scanned
  // A field the product cannot sell without, with nothing going into it. This
  // is the work, and it is the only state the row draws attention to.
  const needed = field.blocks_sale && !imported

  // "Keep what we read" only while there is a scanned value this cell keeps.
  const placeholder =
    scanned && !cleared
      ? t("keepSource")
      : translation
        ? t("addTranslation")
        : t("addValue")

  return (
    <div className={cn("grid", REVIEW_GRID)}>
      <div className="min-w-0 px-4 pt-3 pb-1 sm:pb-3">
        <Label htmlFor={inputId} className="text-sm font-medium leading-snug">
          {label}
        </Label>
        <p id={captionId} className="mt-0.5 text-xs text-muted-foreground">
          {needed ? (
            <span className="text-amber-600 dark:text-amber-400">
              {t("needed")}
            </span>
          ) : cleared ? (
            t("cleared")
          ) : translation ? (
            t("sourceEnglish")
          ) : field.never_scanned ? (
            t("notInSource")
          ) : (
            t("fromSource")
          )}
        </p>
      </div>

      {/* The reference cell. Text on a grey ground rather than a disabled
          input: it is not a control the merchant can reach, and a greyed-out
          box invites clicking into it. The ground carries the read-only
          meaning, so the value itself can be full contrast. */}
      <div className="min-w-0 bg-muted px-4 py-3">
        <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
          {translation ? t("columnEnglish") : t("columnScanned")}
        </span>
        {shown ? (
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm",
              multiline && "max-h-40 overflow-y-auto",
              numeric && "tabular-nums rtl:text-end",
            )}
            dir={numeric ? "ltr" : "auto"}
          >
            {shown}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("sourceEmpty")}</p>
        )}
        {translation && scanned && (
          <div className="mt-3 border-t border-border/70 pt-2">
            <p className="text-xs text-muted-foreground">
              {t("scannedTranslation")}
            </p>
            <p
              className={cn(
                "mt-0.5 whitespace-pre-wrap break-words text-sm",
                multiline && "max-h-40 overflow-y-auto",
              )}
              dir="auto"
            >
              {scanned}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "min-w-0 border-t border-border transition-colors sm:border-t-0",
          overridden && "bg-primary/5 dark:bg-primary/10",
        )}
        data-overridden={overridden || undefined}
      >
        <span className="block px-4 pt-2 text-xs text-muted-foreground sm:hidden">
          {translation ? t("columnArabic") : t("columnImported")}
        </span>
        {control ? (
          // A field whose value is not free text — the category's taxonomy id.
          // Given the cell's own padding rather than the flush treatment,
          // because the control inside it draws its own edges.
          <div className="px-4 py-3">{control}</div>
        ) : multiline ? (
          <Textarea
            id={inputId}
            aria-describedby={describedBy}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={5}
            dir="auto"
            className={cn("min-h-32 resize-y", FLUSH_INPUT)}
          />
        ) : (
          <Input
            id={inputId}
            aria-describedby={describedBy}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            inputMode={numeric ? "decimal" : undefined}
            maxLength={field.max_length ?? undefined}
            dir={numeric ? "ltr" : "auto"}
            className={cn(
              "h-auto min-h-11",
              FLUSH_INPUT,
              numeric && "tabular-nums rtl:text-end",
            )}
          />
        )}

        {/* The answer the merchant has to decide about, because this cell
            already carried their own words. Never rendered for an empty cell:
            there, an answer is staged directly and Revert is the undo. */}
        {ai?.proposal && (
          <div role="status" className="border-t border-primary/20 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{t("aiProposal")}</p>
            <p
              className="mt-1 whitespace-pre-wrap break-words text-sm"
              dir="auto"
            >
              {plainPreview(ai.proposal)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="xs" onClick={ai.onAccept}>
                {t("aiUseThis")}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={ai.onDismiss}
              >
                {t("aiKeepMine")}
              </Button>
            </div>
          </div>
        )}

        {ai?.error && (
          <p
            role="alert"
            className="border-t border-destructive/20 px-4 py-2 text-xs text-destructive"
          >
            {ai.error}
          </p>
        )}

        {/* Only when there is something to say: the AI control, a counter for
            a bounded field, a Revert for an overridden one. `justify-end` is
            the inline end, so it mirrors. The counter reaches assistive tech
            through the input's `aria-describedby`, not a live region — it
            changes on every keystroke. */}
        {(!!field.max_length || overridden || !!ai) && (
          <div className="flex items-center justify-end gap-3 px-4 pb-2.5 text-xs text-muted-foreground">
            {/* `me-auto` puts it at the row's start, opposite the counter —
                the merchant's own two controls stay together at the end. */}
            {ai && <FieldAiControl ai={ai} label={label} className="me-auto" />}
            {overridden && (
              <button
                type="button"
                onClick={onRevert ?? (() => onChange(""))}
                disabled={disabled}
                aria-label={t("revertField", { field: label })}
                className="rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {t("revert")}
              </button>
            )}
            {field.max_length ? (
              <span id={counterId} className="tabular-nums">
                {t("charactersUsed", {
                  used: value.length,
                  max: field.max_length,
                })}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A proposed answer, as one readable block.
 *
 * A description's proposal is HTML, and rendering it raw would be the one place
 * on this screen where a model's output reaches the DOM as markup. It is shown
 * as text instead — the merchant is deciding whether the *words* are better,
 * and the markup is what gets staged if they say yes.
 */
function plainPreview(value: string): string {
  return plainLine(value)
}

/**
 * The row's AI control: one press for a field with one action, a menu for a
 * field with several.
 *
 * `xs` and ghost, sitting in the footer strip beside the counter, because this
 * is an offer rather than the row's purpose — the merchant came here to type.
 * It names the field, so a screen reader hears "Improve Title" rather than
 * "Improve" eleven times down a card.
 */
function FieldAiControl({
  ai,
  label,
  className,
}: {
  ai: RowAi
  label: string
  className?: string
}) {
  const t = useTranslations("products.import.review")
  if (ai.actions.length === 0) return null

  const denied = (action: AiAction) => ai.deniedReasons?.[action]
  const allDenied = ai.actions.every((action) => !!denied(action))
  const firstDenied = ai.actions.map(denied).find(Boolean) ?? undefined

  const icon = ai.running ? (
    <Loader2Icon className="animate-spin" />
  ) : (
    <SparklesIcon />
  )

  // One action — translate, on the two Arabic rows — is a button, not a menu
  // with a single item in it.
  if (ai.actions.length === 1) {
    const action = ai.actions[0]!
    const reason = denied(action)
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className={className}
        disabled={ai.busy || !!reason}
        title={reason}
        aria-busy={ai.running || undefined}
        aria-label={
          t(`aiActions.${action}`) +
          " — " +
          label +
          (reason ? `. ${reason}` : "")
        }
        onClick={() => ai.onRun(action)}
      >
        {icon}
        {t(`aiActions.${action}`)}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className={className}
            disabled={ai.busy || allDenied}
            title={allDenied ? firstDenied : undefined}
            aria-busy={ai.running || undefined}
            aria-label={
              t("aiAssist", { field: label }) +
              (allDenied && firstDenied ? `. ${firstDenied}` : "")
            }
          />
        }
      >
        {icon}
        {t("aiAssistShort")}
      </DropdownMenuTrigger>
      {/* Width named explicitly: the items are short and a menu that sizes
          itself to "Simplify" is narrower than its own trigger. */}
      <DropdownMenuContent align="start" className="w-48">
        {ai.actions.map((action) => {
          const reason = denied(action)
          return (
            <DropdownMenuItem
              key={action}
              disabled={!!reason}
              onClick={() => ai.onRun(action)}
            >
              <span className="flex flex-col">
                <span>{t(`aiActions.${action}`)}</span>
                {reason ? (
                  <span className="text-xs text-muted-foreground">{reason}</span>
                ) : null}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The amber marker the rail and the pane share for "still needs a person". */
export function NeedsAttentionBadge({ count }: { count: number }) {
  const t = useTranslations("products.import.review")
  if (count <= 0) return null
  return (
    <Badge
      variant="secondary"
      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      {t("needsAttention", { count })}
    </Badge>
  )
}
