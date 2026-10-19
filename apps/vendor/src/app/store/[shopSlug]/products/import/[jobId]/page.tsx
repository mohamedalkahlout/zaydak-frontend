import { StoreImportProgress } from "@/features/products/components/import/store-import-progress"
import { carryFromParam } from "@/features/products/lib/store-import"

/**
 * One store import, by id.
 *
 * A route rather than a pane in the import dialog, because the work outlives
 * the tab: a scan crawls somebody's whole catalogue over minutes, and a
 * merchant who closes the dialog has to be able to come back to it. It is also
 * what `navigate_to_form`'s `store_import` target deep-links to from the
 * assistant.
 *
 * `?from=<jobId>` is set by "Scan again" and names the job this scan replaced,
 * so a READY scan can offer to bring that job's edits over. Without it the
 * carry card finds the previous scan of the same store in the job list, and
 * `?from=` wins when both exist. It is only a hint: the server checks the
 * shop, the store and both jobs' state before it carries anything.
 *
 * Nothing is preloaded on the server the way the products list is: the job is
 * a moving number that the client polls, so an RSC snapshot of it would be
 * stale in the markup before it painted.
 */
export default async function StoreImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string; jobId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { shopSlug, jobId } = await params
  const { from } = await searchParams

  return (
    <StoreImportProgress
      jobId={jobId}
      shopSlug={shopSlug}
      fromJobId={carryFromParam(from, jobId)}
    />
  )
}
