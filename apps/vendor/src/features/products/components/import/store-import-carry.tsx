"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { CopyCheckIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  CARRY_STORE_IMPORT_OVERRIDES,
  GET_STORE_IMPORT_CARRY_CANDIDATES,
  GET_STORE_IMPORT_CARRY_SOURCE,
  type CarryStoreImportOverridesData,
  type StoreImportCarryCandidatesData,
  type StoreImportCarryResult,
  type StoreImportCarrySourceData,
  type StoreImportJob,
} from "@/features/products/api"
import {
  CARRY_CANDIDATE_LIMIT,
  carryCandidate,
  carryOfferCount,
  storeImportErrorKey,
  unmatchedOverflow,
} from "@/features/products/lib/store-import"

/**
 * "Bring over the edits from the previous scan" — offered on a new scan once
 * it is READY, never done for the merchant.
 *
 * Opt-in because it writes: it stores the previous job's edits on this one
 * (nothing reaches the catalogue until the approval). The server decides which
 * product each edit belongs to, by the old store's own product id and never by
 * the handle, so what this card adds is the two numbers kept apart afterwards:
 * how many products got their edits, and which ones did not. A carry that left
 * half the edits behind must not read as complete. Removed photos carry too,
 * re-checked against this scan's images; the ones this scan no longer lists
 * get their own line, because the store may now serve them at a new address
 * that this scan would import.
 *
 * Which previous scan: the one `?from=` names when the URL has it (Scan again
 * sets it), and otherwise the newest earlier scan of the same store that still
 * has edits, picked out of this shop's job list during render
 * (`carryCandidate`) — so a new scan started from the import dialog gets the
 * offer too. `?from=` wins outright; the list is not even asked for.
 *
 * Renders nothing when there is nothing to offer — no previous job, a
 * different store, no edits on it, or a previous job the query could not read.
 */
export function StoreImportCarry({
  job,
  fromJobId,
}: {
  job: StoreImportJob
  fromJobId: string | null
}) {
  const t = useTranslations("products.import.progress.carry")
  const te = useTranslations("products.import.errors")

  const named = useQuery<StoreImportCarrySourceData>(
    GET_STORE_IMPORT_CARRY_SOURCE,
    {
      variables: { id: fromJobId ?? "" },
      skip: !fromJobId,
      fetchPolicy: "cache-and-network",
    },
  )
  const listed = useQuery<StoreImportCarryCandidatesData>(
    GET_STORE_IMPORT_CARRY_CANDIDATES,
    {
      variables: { limit: CARRY_CANDIDATE_LIMIT },
      skip: Boolean(fromJobId),
      fetchPolicy: "cache-and-network",
    },
  )
  const [carry, { loading }] = useMutation<CarryStoreImportOverridesData>(
    CARRY_STORE_IMPORT_OVERRIDES,
  )

  const [result, setResult] = useState<StoreImportCarryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const source = fromJobId
    ? named.data?.storeImportJob?.data
    : carryCandidate(job, listed.data?.storeImportJobs?.data)
  const count = carryOfferCount(job, source)

  if (dismissed) return null
  if (!result && count === 0) return null

  const bringOver = async () => {
    if (!source) return
    setError(null)
    try {
      const { data: answer } = await carry({
        variables: { input: { id: job.id, from_job_id: source.id } },
      })
      const outcome = answer?.carryStoreImportOverrides
      if (!outcome) return
      setResult({
        matched: outcome.matched,
        unmatched: outcome.unmatched,
        unmatched_handles: outcome.unmatched_handles,
        dropped_images_not_carried: outcome.dropped_images_not_carried,
        dropped_images_not_carried_handles:
          outcome.dropped_images_not_carried_handles ?? [],
      })
    } catch (err) {
      const key = storeImportErrorKey(err)
      setError(key ? te(key) : te("generic"))
    }
  }

  if (result) {
    const overflow = unmatchedOverflow(result)
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CopyCheckIcon className="size-4 text-muted-foreground" />
          {t("doneTitle")}
        </h2>
        <p className="mt-2 text-sm">{t("matched", { count: result.matched })}</p>
        {result.dropped_images_not_carried > 0 && (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              {t("dropsNotCarried", {
                count: result.dropped_images_not_carried,
              })}
            </p>
            {/* Which products, not just how many: the review lists them by
                these handles. */}
            <HandleList handles={result.dropped_images_not_carried_handles} />
          </div>
        )}
        {result.unmatched > 0 && (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              {t("unmatched", { count: result.unmatched })}
            </p>
            <HandleList handles={result.unmatched_handles} />
            {overflow > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("unmatchedMore", { count: overflow })}
              </p>
            )}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
            {t("close")}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CopyCheckIcon className="size-4 text-muted-foreground" />
        {t("title", { count })}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
          {t("dismiss")}
        </Button>
        <Button size="sm" disabled={loading} onClick={() => void bringOver()}>
          {loading ? t("bringing") : t("bring", { count })}
        </Button>
      </div>
    </section>
  )
}

/** Product handles as chips, left-to-right whatever the page direction. */
function HandleList({ handles }: { handles: string[] }) {
  if (handles.length === 0) return null
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {handles.map((handle) => (
        <li
          key={handle}
          dir="ltr"
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
        >
          {handle}
        </li>
      ))}
    </ul>
  )
}
