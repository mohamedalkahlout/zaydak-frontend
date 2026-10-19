import { StoreImportReviewEditor } from "@/features/products/components/import/review/store-import-review-editor"

/**
 * Review and edit a scanned catalogue before approving it.
 *
 * Its own route rather than a pane on the progress screen, for two reasons that
 * pull the same way. The work is long — a merchant setting stock on two hundred
 * products leaves and comes back — and it wants the whole width, which the
 * progress screen's ladder-plus-content grid does not have to give.
 *
 * Optional by design (2026-09-15 decision): the progress screen keeps its
 * Approve button, so "import exactly what you found" stays one click and this
 * is the door for merchants who want to look first. Nothing here writes to the
 * catalogue — the approval still does that, and still only from there.
 */
export default async function StoreImportReviewPage({
  params,
}: {
  params: Promise<{ shopSlug: string; jobId: string }>
}) {
  const { shopSlug, jobId } = await params

  return <StoreImportReviewEditor jobId={jobId} shopSlug={shopSlug} />
}
