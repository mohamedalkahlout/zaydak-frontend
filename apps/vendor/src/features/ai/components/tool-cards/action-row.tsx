"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { AgentOrb, orbStateForTool } from "../agent-orb"
import type { VendorAgentToolEvent } from "@/features/ai/lib/types"
import {
  humanizeProgress,
  humanizeTool,
  type Locale,
} from "@/features/ai/lib/humanize-tool"
import { isFormAlreadyOpenRefusal } from "@/features/ai/lib/live-form"
import { ToolEventRenderer } from "./tool-event-renderer"

/** Tool names that produce a rich, worth-expanding result card in
 * ToolEventRenderer. Anything else is a leaf action — the humanized row says
 * it all, so we don't offer a disclosure that would only reveal a bare
 * "Tool: x" placeholder. Kept here (not derived) so a row never promises a
 * card the renderer won't produce. */
const RICH_CARD_TOOLS = new Set([
  "list_collections",
  "list_system_categories",
  "search_products",
  "get_product",
  "delete_product",
  "get_shop_stats",
  "get_low_stock_products",
  "list_inventory_locations",
  "update_collection",
  "delete_collection",
  "add_product_to_collection",
  "remove_product_from_collection",
  "get_top_products",
  "get_yearly_sales",
  "get_category_sales",
  "get_custom_range_stats",
  "list_coupons",
  "get_coupon",
  "delete_coupon",
  // The generation card polls to completion, so it IS the deliverable of this
  // tool. Without it here the row was a bare line and the card was unreachable.
  "generate_product_image",
])

/** True when this successful event has a rich result card worth expanding —
 * used by the turn renderer to auto-open the final data-bearing action.
 *
 * The `result != null` half is load-bearing: a `tool_start` event is created
 * optimistically as `{ ok: true, result: null }`, so without it a row that is
 * still spinning offers a disclosure that opens onto a placeholder. */
export function actionHasCard(event: VendorAgentToolEvent): boolean {
  if (!event.ok || event.result == null) return false
  return RICH_CARD_TOOLS.has(event.name) || needsLocation(event.result)
}

/** A write tool that stopped to ask which warehouse. Matched on the result's
 * shape, like the renderer does, because the tool name (`create_product`) is
 * otherwise a leaf action — and the list the vendor is choosing from has to
 * be reachable from the row, or the question arrives with no options. */
function needsLocation(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>).needs_location === true &&
    "locations" in result
  )
}

interface Props {
  event: VendorAgentToolEvent
  currency: string
  locale: Locale
  /** Expand the result card on first paint. The turn renderer expands the
   * final data-bearing action and collapses the intermediate lookups. */
  defaultExpanded?: boolean
  /** How many identical calls this row stands for, folded by the turn
   * renderer. 1 (the default) shows no badge. */
  repeat?: number
  /** Passed to the result card so it can offer a choice the vendor would
   * otherwise have to retype. Absent in the read-only shared view. */
  onSuggest?: (text: string) => void
}

/**
 * One line in the assistant's "work log": a humanized icon + label + status,
 * standing in for a raw tool name. When the tool carries a rich result card,
 * the row becomes a disclosure the vendor can open to see the data. Errors
 * always show their detail; pending rows spin.
 */
export function ActionRow({
  event,
  currency,
  locale,
  defaultExpanded,
  repeat = 1,
  onSuggest,
}: Props) {
  const t = useTranslations("aiChat.toolLog")
  const { icon: Icon, running, done, failed: failedLabel } = humanizeTool(
    event,
    t,
  )
  // A refusal that is not a failure: the assistant tried to open a second
  // card for the form already on screen, was told to change that form
  // instead, and usually did — with the patch card right below. A red
  // "Operation failed" card above the fix read as if something had broken.
  const quiet = isFormAlreadyOpenRefusal(event)
  // `failed` is checked first: a tool that reported `ok: false` without an
  // `error` string still has a null result, and reading that as "pending"
  // spun a red row under a present-tense label forever.
  const failed = !event.ok && !quiet
  const pending = !failed && !quiet && event.result == null && !event.error
  const hasCard = actionHasCard(event)

  const [open, setOpen] = useState(!!defaultExpanded)

  // Mid-tool progress, when the tool bothered to narrate itself. Only while
  // pending: a frame that outlived its result would put a bar under a
  // finished row. Everything about it is optional, so a tool that says
  // nothing keeps exactly the spinner and label it had before.
  const progress =
    pending && event.progress
      ? humanizeProgress(event.progress, t)
      : null

  // A failed row used to keep the present-tense "Matching the category…",
  // which reads as still-in-progress next to a red triangle.
  const label = pending
    ? (progress?.text ?? running)
    : quiet
      ? t("formAlreadyOpen")
      : failed
        ? failedLabel
        : done

  const status = (
    <span className="grid size-5 shrink-0 place-items-center">
      {pending ? (
        <AgentOrb state={orbStateForTool(event.name)} />
      ) : quiet ? (
        <span className="grid size-5 place-items-center rounded-full bg-muted text-muted-foreground">
          <InfoIcon className="size-3" aria-hidden="true" />
        </span>
      ) : failed ? (
        <AlertTriangleIcon className="size-3.5 text-destructive" />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      )}
    </span>
  )

  const line = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
        hasCard && "cursor-pointer hover:bg-muted/60 transition-colors",
      )}
    >
      {status}
      <Icon
        className={cn(
          "size-4 shrink-0",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      />
      <span
        dir="auto"
        title={label}
        className={cn(
          "min-w-0 flex-1 truncate",
          pending ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {progress?.counts && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {progress.counts}
        </span>
      )}
      {repeat > 1 && (
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums"
          title={t("repeated")}
        >
          ×{repeat}
        </span>
      )}
      {hasCard && (
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      )}
    </div>
  )

  // The bar only renders when the tool reported a fraction. A tool that can
  // only name its phase — an async enqueue — gets the label and the spinner
  // and nothing else: a bar with no honest value is worse than no bar.
  const row =
    progress && (progress.percent !== null || progress.label) ? (
      <div>
        {line}
        <div className="flex items-center gap-2 ps-9 pe-2 pb-1.5">
          {progress.percent !== null && (
            <div
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={label}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          )}
          {progress.label && (
            <span
              dir="auto"
              title={progress.label}
              className="min-w-0 max-w-[50%] truncate font-mono text-[10px] text-muted-foreground"
            >
              {progress.label}
            </span>
          )}
        </div>
      </div>
    ) : (
      line
    )

  // Errors: show the row plus the error detail card, always expanded.
  if (failed) {
    return (
      <div className="space-y-1.5">
        {row}
        <ToolEventRenderer event={event} currency={currency} locale={locale} />
      </div>
    )
  }

  if (!hasCard) return row

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-start"
        aria-expanded={open}
      >
        {row}
      </button>
      {open && (
        <div className="pt-1.5">
          <ToolEventRenderer
            event={event}
            currency={currency}
            locale={locale}
            onSuggest={onSuggest}
          />
        </div>
      )}
    </div>
  )
}
