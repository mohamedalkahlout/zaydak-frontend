"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  GlobeIcon,
} from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  CANCEL_STORE_IMPORT,
  CREATE_STORE_IMPORT,
  GET_STORE_IMPORT_JOB,
  type CancelStoreImportData,
  type CreateStoreImportData,
  type StoreImportJob,
  type StoreImportJobData,
} from "@/features/products/api"
import {
  canRescanStoreImport,
  hasStoreImportReport,
  isStoreImportTerminal,
  shouldPollStoreImport,
  showsStrategyTrace,
  sourceLabel,
  storeImportErrorKey,
  storeImportJobErrorKey,
} from "@/features/products/lib/store-import"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { StoreImportCarry } from "./store-import-carry"
import { StoreImportImages } from "./store-import-images"
import { StoreImportLadder } from "./store-import-ladder"
import { StoreImportMissing } from "./store-import-missing"
import { StoreImportReview } from "./store-import-review"
import { StoreImportTrace } from "./store-import-trace"

/** How often the screen asks. The scan reports per phase, not per product. */
const POLL_MS = 2500

/**
 * One migration, while it runs and after it has finished.
 *
 * **Polled, not streamed** (plan §10). A scan takes minutes, a merchant closes
 * the tab, and the job is a URL they come back to — a socket would buy a
 * smoother number and lose the thing that matters, which is that this screen
 * can be re-opened from anywhere. Polling stops on its own at every state
 * where nothing moves: a READY job waits for a person, and a terminal one
 * waits for nobody (`shouldPollStoreImport`).
 */
export function StoreImportProgress({
  jobId,
  shopSlug,
  fromJobId = null,
}: {
  jobId: string
  shopSlug: string
  /**
   * The job this scan was started from with "Scan again", read off `?from=`.
   * When set, a READY scan offers that job's edits; when not, the carry card
   * looks for the previous scan of the same store itself.
   */
  fromJobId?: string | null
}) {
  const t = useTranslations("products.import.progress")
  const te = useTranslations("products.import.errors")
  const shopCurrency = useShopCurrency()

  // Set when this tab approved the scan. A committed job sits at READY until
  // the worker picks it up, and the poll rule stops at READY on purpose — so
  // without this the screen would go quiet at the exact moment it has
  // something to report.
  const [justCommitted, setJustCommitted] = useState(false)

  const { data, loading, refetch, startPolling, stopPolling } =
    useQuery<StoreImportJobData>(GET_STORE_IMPORT_JOB, {
      variables: { id: jobId },
      fetchPolicy: "cache-and-network",
    })

  const job = data?.storeImportJob?.data ?? null

  const [cancel, { loading: cancelling }] = useMutation<CancelStoreImportData>(
    CANCEL_STORE_IMPORT,
    { variables: { id: jobId } },
  )

  const poll = job
    ? shouldPollStoreImport(job) || (justCommitted && job.status === "READY")
    : true

  // The timer is Apollo's, started and stopped from an effect rather than
  // declared as a `pollInterval` option: the interval depends on the answer,
  // and options are built before the answer arrives. Nothing here sets state —
  // it is a subscription to an external system, which is what an effect is for.
  useEffect(() => {
    if (poll) startPolling(POLL_MS)
    else stopPolling()
    return () => stopPolling()
  }, [poll, startPolling, stopPolling])

  if (!job) {
    return loading ? (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{t("notFound")}</p>
    )
  }

  const errorKey = storeImportJobErrorKey(job.error)
  const report = job.import_report
  const hasReport = hasStoreImportReport(job)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GlobeIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {job.scope === "PRODUCT" ? t("titleProduct") : t("title")}
            </h1>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              {t("reading", { host: sourceLabel(job) })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <StoreImportRescan job={job} shopSlug={shopSlug} />
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/store/${shopSlug}/products`} />}
          >
            <ArrowLeftIcon className="size-3.5 rtl:rotate-180" />
            {t("backToProducts")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4">
          <StoreImportLadder status={job.status} />
          {!isStoreImportTerminal(job.status) && job.status !== "READY" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={cancelling}
              onClick={() => {
                void cancel()
                  .then(() => refetch())
                  .catch(() => undefined)
              }}
            >
              {cancelling ? t("stopping") : t("stop")}
            </Button>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {job.status === "FAILED" && (
            <section className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("stoppedTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorKey ? te(errorKey) : te("generic")}
                </p>
              </div>
            </section>
          )}

          {showsStrategyTrace(job) && (
            <StoreImportTrace steps={job.strategy_trace ?? []} />
          )}

          {job.status === "CANCELLED" && (
            <section className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium">{t("cancelledTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("cancelledBody")}
              </p>
            </section>
          )}

          {job.status === "READY" && (
            <StoreImportCarry job={job} fromJobId={fromJobId} />
          )}

          {job.status === "READY" && (
            <StoreImportReview
              job={job}
              shopSlug={shopSlug}
              shopCurrency={shopCurrency}
              onCommitted={() => {
                setJustCommitted(true)
                void refetch()
              }}
            />
          )}

          {job.status === "DONE" && (
            <section className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("done.title")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("done.body", {
                    created: report?.created ?? 0,
                    updated: report?.updated ?? 0,
                    skipped: report?.skipped ?? 0,
                  })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("done.draftNote")}
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  render={<Link href={`/store/${shopSlug}/products`} />}
                >
                  {t("done.viewProducts")}
                </Button>
              </div>
            </section>
          )}

          {hasReport && (
            <>
              <StoreImportCounts job={job} />
              <StoreImportImages job={job} />
            </>
          )}

          {job.missing_from_source && (
            <StoreImportMissing
              report={job.missing_from_source}
              shopSlug={shopSlug}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** What the scan found, before anything is written. */
function StoreImportCounts({
  job,
}: {
  job: NonNullable<StoreImportJobData["storeImportJob"]["data"]>
}) {
  const t = useTranslations("products.import.progress.counts")
  const tp = useTranslations("products.import.progress")

  const platform = job.detected_platform ?? job.requested_platform

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={t("urls")} value={job.discovered_urls} />
        <Stat label={t("products")} value={job.products_found} />
        <Stat label={t("skus")} value={job.skus_found} />
        <Stat label={t("new")} value={job.new_products} />
        <Stat label={t("matched")} value={job.matched_products} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t("matchedHelp")}</p>
      {job.detected_platform && (
        <p className="mt-1 text-xs text-muted-foreground">
          {tp("detected", { platform })}
          {job.requested_platform !== "AUTO" &&
          job.requested_platform !== job.detected_platform
            ? ` · ${tp("requested", { platform: job.requested_platform })}`
            : ""}
        </p>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {value == null ? "—" : value}
      </dd>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: NonNullable<StoreImportJobData["storeImportJob"]["data"]>["status"]
}) {
  const t = useTranslations("products.import.progress")
  if (status === "FAILED") {
    return <Badge variant="destructive">{t("stoppedTitle")}</Badge>
  }
  if (status === "CANCELLED") {
    return <Badge variant="outline">{t("cancelledTitle")}</Badge>
  }
  return <Badge variant="secondary">{t(`steps.${status}`)}</Badge>
}

function StoreImportRescan({
  job,
  shopSlug,
}: {
  job: StoreImportJob
  shopSlug: string
}) {
  const t = useTranslations("products.import.progress")
  const te = useTranslations("products.import.errors")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [create, { loading }] = useMutation<CreateStoreImportData>(
    CREATE_STORE_IMPORT,
  )

  if (!canRescanStoreImport(job.status)) return null

  const confirm = async () => {
    setError(null)
    try {
      const { data } = await create({
        variables: {
          input: {
            source_url: job.source_url,
            requested_platform: job.requested_platform,
            attested_owner: true,
            // Repeat the scope, or scanning a product again would crawl the
            // whole store from that product's page. Sent only for PRODUCT,
            // for the reason the import dialog gives.
            ...(job.scope === "PRODUCT" && { scope: "PRODUCT" as const }),
          },
        },
      })
      const next = data?.createStoreImport?.data
      if (!next) return
      setOpen(false)
      // `from` is what lets the new scan offer to bring this one's edits
      // over once it is READY. In the URL rather than in memory, so a
      // merchant who closes the tab while it scans still gets the offer.
      router.push(
        `/store/${shopSlug}/products/import/${next.id}?from=${encodeURIComponent(job.id)}`,
      )
    } catch (err) {
      const key = storeImportErrorKey(err)
      setError(key ? te(key) : te("generic"))
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("scanAgain")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("scanAgainTitle")}</DialogTitle>
            <DialogDescription>{t("scanAgainBody")}</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("scanAgainCancel")}
            </Button>
            <Button type="button" disabled={loading} onClick={() => void confirm()}>
              {loading ? t("scanAgainStarting") : t("scanAgainConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
