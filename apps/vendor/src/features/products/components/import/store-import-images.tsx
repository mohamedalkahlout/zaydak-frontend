"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ImageIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  GET_STORE_IMPORT_MEDIA_ISSUES,
  RETRY_STORE_IMPORT_MEDIA,
  SKIP_STORE_IMPORT_MEDIA,
  type RetryStoreImportMediaData,
  type SkipStoreImportMediaData,
  type StoreImportJob,
  type StoreImportMediaIssue,
  type StoreImportMediaIssuesData,
} from "@/features/products/api"

/**
 * The image half of an import, as three separate numbers.
 *
 * **In transfer is not failed, and the two never share a cell.** An import
 * moves every image onto our storage in its own queue, so a product sits with
 * images pending for minutes after the products themselves have landed — and
 * during that window a single "images: 40 / 112" reads as a catastrophe.
 * Collapsing pending into failed hides which of the two is happening.
 *
 * The per-row issues list covers FAILED, SKIPPED, and PENDING rows quiet past
 * the reconcile window (the service's `needsAttention`). Fresh PENDING stays
 * on the counters only so a healthy walk does not flood the panel.
 */
export function StoreImportImages({ job }: { job: StoreImportJob }) {
  const t = useTranslations("products.import.progress.images")
  const showIssues = job.images_failed > 0 || job.images_pending > 0

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ImageIcon className="size-4 text-muted-foreground" />
        {t("title")}
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter label={t("found")} value={job.images_found} />
        <Counter label={t("pending")} value={job.images_pending} />
        <Counter label={t("transferred")} value={job.images_transferred} />
        <Counter
          label={t("failed")}
          value={job.images_failed}
          tone={job.images_failed > 0 ? "warn" : undefined}
        />
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">{t("help")}</p>

      {showIssues && <MediaIssues jobId={job.id} />}
    </section>
  )
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "warn"
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-600" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

/** Rows behind the failed / stuck-pending counters, each with retry and skip. */
function MediaIssues({ jobId }: { jobId: string }) {
  const t = useTranslations("products.import.progress.images")

  const { data, refetch } = useQuery<StoreImportMediaIssuesData>(
    GET_STORE_IMPORT_MEDIA_ISSUES,
    {
      variables: { job_id: jobId },
      // Quiet PENDING ages into the list while the merchant is watching.
      pollInterval: 15_000,
    },
  )
  const issues = data?.storeImportMediaIssues?.data ?? []

  if (issues.length === 0) return null

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-sm font-medium">{t("issuesTitle")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("issuesBody")}</p>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {issues.map((issue) => (
          <MediaIssueRow
            key={issue.id}
            issue={issue}
            onSettled={() => {
              void refetch()
            }}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * One image that is not on our storage.
 *
 * Retry is per row rather than a single "retry all" because the failures are
 * rarely one thing: a 404 will fail again, a timeout probably will not, and
 * the merchant is usually retrying the one they have just re-uploaded at the
 * source. Skip is the other half — a decision that the product no longer waits
 * on this URL. SKIPPED rows keep Retry hidden; a drop is terminal.
 */
function MediaIssueRow({
  issue,
  onSettled,
}: {
  issue: StoreImportMediaIssue
  onSettled: () => void
}) {
  const t = useTranslations("products.import.progress.images")
  const [retried, setRetried] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [retry, { loading: retrying }] = useMutation<RetryStoreImportMediaData>(
    RETRY_STORE_IMPORT_MEDIA,
    { variables: { media_id: issue.id } },
  )
  const [skip, { loading: skipping }] = useMutation<SkipStoreImportMediaData>(
    SKIP_STORE_IMPORT_MEDIA,
    { variables: { media_id: issue.id } },
  )

  const busy = retrying || skipping
  const canRetry = issue.status !== "SKIPPED" && !retried && !skipped
  const canSkip =
    (issue.status === "FAILED" || issue.status === "PENDING") &&
    !skipped &&
    !retried

  const handleRetry = async () => {
    try {
      await retry()
      setRetried(true)
      onSettled()
    } catch {
      // The shared error link has already said so. Leaving the button live is
      // the point: a retry that failed is a row still worth retrying.
    }
  }

  const handleSkip = async () => {
    try {
      await skip()
      setSkipped(true)
      onSettled()
    } catch {
      // Same as retry — keep the button so a transient failure is not a trap.
    }
  }

  const statusLabel =
    issue.status === "PENDING"
      ? t("statusStuck")
      : issue.status === "SKIPPED"
        ? t("statusSkipped")
        : t("statusFailed")

  return (
    <li className="flex items-start gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {issue.product_name ?? issue.product_id}
        </p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {issue.source_url}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {statusLabel} · {t("position", { position: issue.position + 1 })} ·{" "}
          {t("attempts", { count: issue.attempts })}
          {issue.error ? ` · ${issue.error}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        {retried ? (
          <span className="text-xs text-muted-foreground">{t("retried")}</span>
        ) : skipped ? (
          <span className="text-xs text-muted-foreground">{t("skipped")}</span>
        ) : (
          <>
            {canSkip && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleSkip}
              >
                {skipping ? t("skipping") : t("skip")}
              </Button>
            )}
            {canRetry && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={handleRetry}
              >
                <RotateCcwIcon className="size-3.5" />
                {retrying ? t("retrying") : t("retry")}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  )
}
