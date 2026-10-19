"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  AI_CONTENT_HOURLY_ALLOWANCE,
  SUGGEST_SYSTEM_CATEGORIES,
  type StoreImportField,
  type StoreImportProduct,
  type SystemCategorySuggestionsData,
} from "@/features/products/api"
import { aiErrorKey } from "@/features/products/lib/store-import-ai"
import {
  AI_REQUESTS_PER_HOUR,
  CATEGORY_FILL_BATCH,
  categoryField,
  categoryFillPicks,
  planCategoryFill,
  stageCategoryPicks,
  type CategoryFillPlan,
} from "@/features/products/lib/store-import-ai-fill"
import type { ReviewDraft } from "@/features/products/lib/store-import-review"

/** What a finished (or stopped, or refused) run did. */
interface FillOutcome {
  filled: number
  ambiguous: number
  unplaced: number
  /** Planned, and never sent: the run stopped or was refused before them. */
  notAsked: number
  stopped: boolean
  /** A `products.import.review` message key, when the server refused a request. */
  refusal: string | null
}

/**
 * "Suggest categories for this page": the toolbar action, its estimate and
 * its run.
 *
 * The per-product button asks about one product; a merchant catching up a
 * scanned catalogue has fifty on the page with no category. This asks about
 * all of them in the batches `suggestSystemCategories` takes — and because
 * that is several billed-against-the-limiter requests from one press, the
 * dialog does three things before and while it spends anything:
 *
 * - **It states the estimate first.** How many products, how many requests,
 *   what they count against (the per-user hourly limiter, shared with every
 *   AI action) and what they do not (the plan's AI allowance: suggesting a
 *   category is free on every plan). Nothing is sent until Confirm.
 * - **It runs one request at a time, with a Stop between them.** Stop lets
 *   the request in flight finish — its answers are paid for — and sends no
 *   more.
 * - **It keeps what it filled.** A refusal part-way (the limiter, a provider
 *   that did not answer) ends the run with the reason and the count left
 *   over; what the earlier requests filled stays staged.
 *
 * Suggestions are staged through the screen's own draft (`onStage`), like a
 * category picked by hand: nothing here saves, and Revert, Discard, Save and
 * the leave guard cover them with no code of their own. The dialog is modal
 * for the length of the run, which is also what keeps "one AI call in flight
 * for the whole screen" true — the row buttons cannot be reached under it.
 */
export function AiCategoryFillDialog({
  products,
  draft,
  fields,
  busy,
  onStage,
}: {
  /** The page on screen. The run never reaches past it. */
  products: StoreImportProduct[]
  draft: ReviewDraft
  fields: StoreImportField[]
  /** The page is loading, a save is in flight, or a row's AI call is running. */
  busy: boolean
  onStage: (update: (draft: ReviewDraft) => ReviewDraft) => void
}) {
  const t = useTranslations("products.import.review")
  const tf = useTranslations("products.import.review.aiFill")
  const locale = useLocale()
  const [suggest] = useMutation<SystemCategorySuggestionsData>(
    SUGGEST_SYSTEM_CATEGORIES,
  )

  const [open, setOpen] = useState(false)
  /** The plan the run in flight was started with. Null while confirming. */
  const [running, setRunning] = useState<CategoryFillPlan | null>(null)
  const [sent, setSent] = useState(0)
  const [stopping, setStopping] = useState(false)
  const [outcome, setOutcome] = useState<FillOutcome | null>(null)
  // Read between requests by the loop below; a ref because the loop outlives
  // the render that started it.
  const stopRequested = useRef(false)
  const { data: allowanceData } = useQuery<{
    aiContentHourlyAllowance: { limit: number; remaining: number | null }
  }>(AI_CONTENT_HOURLY_ALLOWANCE, { skip: !open })
  const allowance = allowanceData?.aiContentHourlyAllowance

  // No category column on this job: nothing to offer.
  if (!categoryField(fields)) return null

  // Live while confirming, so the estimate is the page as it stands. Frozen
  // into `running` once the run starts: staging its own answers would
  // otherwise shrink the plan under the progress line.
  const plan = planCategoryFill(products, draft, fields)

  const onOpenChange = (next: boolean) => {
    // Not dismissible mid-run: Stop is the way out, and it says what happens.
    if (running) return
    if (next) {
      setOutcome(null)
      setSent(0)
      setStopping(false)
    }
    setOpen(next)
  }

  const run = async () => {
    const started = plan
    if (started.calls === 0) return
    stopRequested.current = false
    setStopping(false)
    setSent(0)
    setRunning(started)

    const tally = { filled: 0, ambiguous: 0, unplaced: 0 }
    let asked = 0
    let stopped = false
    let refusal: string | null = null

    for (const batch of started.batches) {
      if (stopRequested.current) {
        stopped = true
        break
      }
      try {
        const { data } = await suggest({
          variables: { input: { products: batch.items }, locale },
          // Asking again is how a merchant retries; a cached answer would
          // hand back the same nothing.
          fetchPolicy: "no-cache",
        })
        const payload = data?.suggestSystemCategories
        if (!payload?.generated) {
          // No provider answered. The next request would meet the same
          // silence, and each one still spends a unit of the limiter.
          refusal = "aiFailed"
          break
        }
        const picks = categoryFillPicks(batch, payload.data ?? [])
        onStage((previous) =>
          stageCategoryPicks(previous, products, fields, picks.byHandle),
        )
        tally.filled += Object.keys(picks.byHandle).length
        tally.ambiguous += picks.ambiguous
        tally.unplaced += picks.unplaced
        asked += batch.items.length
        setSent((count) => count + 1)
      } catch (err) {
        // The limiter, the plan, or a fault. All of them answer the next
        // request the same way, so the run ends here with what it has.
        refusal = aiErrorKey(err)
        break
      }
    }

    setOutcome({
      ...tally,
      notAsked: started.products - asked,
      stopped,
      refusal,
    })
    setRunning(null)
  }

  const stop = () => {
    stopRequested.current = true
    setStopping(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || products.length === 0}
        aria-label={tf("open")}
        onClick={() => onOpenChange(true)}
      >
        <SparklesIcon aria-hidden />
        <span className="hidden md:inline">{tf("open")}</span>
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{tf("title")}</DialogTitle>
            <DialogDescription>{tf("intro")}</DialogDescription>
          </DialogHeader>

          {running ? (
            <div className="flex flex-col gap-2 text-sm" aria-live="polite">
              <p className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                {tf("running", {
                  current: Math.min(sent + 1, running.calls),
                  calls: running.calls,
                })}
              </p>
              {stopping && (
                <p className="text-xs text-muted-foreground">
                  {tf("stopping")}
                </p>
              )}
            </div>
          ) : outcome ? (
            <div className="flex flex-col gap-2 text-sm" role="status">
              <p className="font-medium">
                {tf("resultFilled", { count: outcome.filled })}
              </p>
              {outcome.ambiguous > 0 && (
                <p>{tf("resultAmbiguous", { count: outcome.ambiguous })}</p>
              )}
              {outcome.unplaced > 0 && (
                <p>{tf("resultUnplaced", { count: outcome.unplaced })}</p>
              )}
              {outcome.refusal && (
                <p role="alert" className="text-destructive">
                  {t(outcome.refusal)}
                </p>
              )}
              {outcome.notAsked > 0 && (
                <p>
                  {outcome.stopped
                    ? tf("resultStopped", { count: outcome.notAsked })
                    : tf("resultNotAsked", { count: outcome.notAsked })}
                </p>
              )}
              {outcome.filled > 0 && (
                <p className="text-xs text-muted-foreground">
                  {tf("resultSave")}
                </p>
              )}
            </div>
          ) : plan.calls === 0 ? (
            <p className="text-sm">{tf("nothing")}</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <ul className="flex list-disc flex-col gap-1.5 ps-5">
                <li>{tf("estimateProducts", { count: plan.products })}</li>
                <li>
                  {tf("estimateCalls", {
                    calls: plan.calls,
                    size: CATEGORY_FILL_BATCH,
                  })}
                </li>
                <li>
                  {allowance && allowance.remaining != null
                    ? tf("estimateRemaining", {
                        remaining: allowance.remaining,
                        limit: allowance.limit,
                      })
                    : tf("estimateLimit", { limit: AI_REQUESTS_PER_HOUR })}
                </li>
                <li>{tf("estimateFree")}</li>
              </ul>
              {plan.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {tf("skipped", { count: plan.skipped })}
                </p>
              )}
              {plan.overCap > 0 && (
                <p className="text-xs text-muted-foreground">
                  {tf("capped", { count: plan.overCap })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{tf("staged")}</p>
            </div>
          )}

          <DialogFooter>
            {running ? (
              <Button
                type="button"
                variant="outline"
                disabled={stopping}
                onClick={stop}
              >
                {tf("stop")}
              </Button>
            ) : outcome || plan.calls === 0 ? (
              <DialogClose render={<Button />}>{tf("close")}</DialogClose>
            ) : (
              <>
                <DialogClose render={<Button variant="outline" />}>
                  {tf("cancel")}
                </DialogClose>
                <Button type="button" onClick={() => void run()}>
                  {tf("confirm", { count: plan.products })}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
