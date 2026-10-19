/**
 * Row selection for the admin lists.
 *
 * Kept apart from the tables because the interesting part is not the checkbox,
 * it is what happens to a selection when the list underneath it moves: the
 * admin lists are server-paginated, so a refetch or a filter change can replace
 * every row on screen while the selection still holds the old ids. A bar acting
 * on rows nobody can see is how a bulk action hits the wrong accounts.
 */

/** Adds `id` if absent, removes it if present. Order is insertion order. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id)
    ? selected.filter((s) => s !== id)
    : [...selected, id]
}

export type HeaderState = "none" | "some" | "all"

/**
 * What the header checkbox shows, given what is selected and what it is allowed
 * to select.
 *
 * `"none"` when nothing eligible is selected — including the case where nothing
 * on the page is eligible at all, so the box is never drawn as "all" over an
 * empty set.
 */
export function headerState(
  selected: readonly string[],
  eligibleIds: readonly string[],
): HeaderState {
  if (eligibleIds.length === 0) return "none"
  const picked = eligibleIds.filter((id) => selected.includes(id)).length
  if (picked === 0) return "none"
  return picked === eligibleIds.length ? "all" : "some"
}

/**
 * Drops ids that are no longer on screen.
 *
 * Called after every refetch and every filter change: an account that left the
 * page is one the admin can no longer see, read or reconsider, and leaving it
 * in the selection means the action bar's count stops matching the ticked boxes.
 */
export function keepVisible(
  selected: readonly string[],
  visibleIds: readonly string[],
): string[] {
  return selected.filter((id) => visibleIds.includes(id))
}
