import { SubscribersTable } from "@/features/plans/components/subscribers-table"

/**
 * Who is paying, on its own route.
 *
 * It was a tab under `/plans`. Splitting it gives the list what a tab could not:
 * a URL an admin can send to someone ("the past-due shops"), a back button that
 * returns to it, and a sidebar entry — a tab is invisible until you have already
 * arrived at the page hiding it. The two screens still share the `plans` feature
 * folder, because they read the same API and the same money helpers.
 */
export default function SubscribersPage() {
  return <SubscribersTable />
}
