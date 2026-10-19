import type { DraftOrder } from "@/features/orders/types"

export const DRAFT_VIEWS = ["all", "open", "completed", "cancelled"] as const
export type DraftView = (typeof DRAFT_VIEWS)[number]

export function draftNumber(id: string) {
  return `#D-${id.slice(-6).toUpperCase()}`
}

export function matchDraft(
  draft: DraftOrder,
  search: string,
  view: DraftView,
): boolean {
  if (view !== "all" && draft.status !== view) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  return (
    draftNumber(draft.id).toLowerCase().includes(q) ||
    (draft.customer_name ?? "").toLowerCase().includes(q) ||
    (draft.customer_contact ?? "").toLowerCase().includes(q) ||
    // Tags exist "for custom views / filtering" and the back-end put a GIN index
    // on them, so a merchant who tags a draft `wholesale` expects this box to
    // find it. Filtering is client-side over the loaded page either way —
    // `draftOrders` takes only page/limit.
    (draft.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
  )
}
