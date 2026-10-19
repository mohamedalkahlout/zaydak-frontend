import { useState } from "react"
import type { RowSelectionState, Updater } from "@tanstack/react-table"
import type { AbandonedCart } from "../types"
import { SELECT_ALL_LIMIT } from "./constants"

/**
 * What "select all matching" brought back, kept only while the selection is
 * still exactly that — one manual tick and the selection is the merchant's
 * own again.
 */
export interface MatchingSelection {
  /** Carts the filter matches. */
  total: number
  /** Ids selected: `total`, or the cap when the list was cut. */
  selected: number
}

interface SelectionState {
  /** The filter this selection was made under. */
  scope: string
  rows: RowSelectionState
  matching: MatchingSelection | null
}

const NO_ROWS: RowSelectionState = {}

/**
 * The carts list's row selection, which outlives the page it was made on.
 *
 * TanStack keeps `rowSelection` keyed by row id and never prunes ids that are
 * not in the current page's data, so one map can hold ticks from several
 * pages and every id "select all matching" returns. What it cannot do is know
 * when that selection stopped meaning anything: change a chip and the ticked
 * carts may not be in the list at all, yet a bulk action would still reach
 * them. So the selection is stamped with the `scope` it was made under and
 * read back only under the same one. A stale selection is not cleared by an
 * effect — it is simply not the selection any more.
 */
export function useCartSelection(scope: string) {
  const [state, setState] = useState<SelectionState>({
    scope,
    rows: NO_ROWS,
    matching: null,
  })
  const live = state.scope === scope

  return {
    rowSelection: live ? state.rows : NO_ROWS,
    matching: live ? state.matching : null,
    /** TanStack's `onRowSelectionChange`: a tick, an untick, a page toggle. */
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      setState((prev) => {
        const base = prev.scope === scope ? prev.rows : NO_ROWS
        return {
          scope,
          rows: typeof updater === "function" ? updater(base) : updater,
          matching: null,
        }
      })
    },
    /**
     * Selects what `abandonedCartIds` answered. `forScope` is the scope the
     * request was made for: an answer that lands after the filter changed is
     * stamped with the old scope and so never becomes the selection.
     */
    selectMatching: (forScope: string, ids: string[], total: number) => {
      setState({
        scope: forScope,
        rows: Object.fromEntries(ids.map((id) => [id, true])),
        matching: { total, selected: ids.length },
      })
    },
    clear: () => setState({ scope, rows: NO_ROWS, matching: null }),
  }
}

/** The selected ids, in the order they were selected. */
export function selectedIdsOf(rows: RowSelectionState): string[] {
  return Object.keys(rows).filter((id) => rows[id])
}

/** `ids` in runs of at most `size`, in order. Nothing is dropped. */
export function chunkIds(ids: string[], size: number): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size))
  }
  return batches
}

/**
 * The carts a reminder can go to. A hidden or completed cart is refused by
 * the back-end (`sendAbandonedCartReminder` answers not-found), and the row's
 * own Remind button is disabled for both, so a bulk send leaves them out
 * before it starts instead of counting them as failures afterwards.
 */
export function remindableCarts(carts: AbandonedCart[]): AbandonedCart[] {
  return carts.filter(
    (cart) => !cart.hidden && cart.reminder_status !== "COMPLETED",
  )
}

export type SelectAllBanner =
  /** Every row on the page is ticked and the list is longer than the page. */
  | {
      kind: "offer"
      pageCount: number
      total: number
      /** Set when the list is longer than one selection holds. */
      limit: number | null
    }
  /** The selection is what "select all matching" returned. */
  | { kind: "all"; selected: number; total: number; cut: boolean }

/**
 * What the row under the bulk bar says, if anything.
 *
 * The header checkbox only ever ticks the page, so once the page is fully
 * ticked the list offers the rest — and says up front when "the rest" is more
 * than one selection holds, rather than selecting 500 and calling it all.
 */
export function selectAllBanner(args: {
  allPageRowsSelected: boolean
  pageRowCount: number
  total: number
  selectedCount: number
  matching: MatchingSelection | null
}): SelectAllBanner | null {
  const { matching, total, selectedCount } = args
  if (matching && selectedCount === matching.selected) {
    return {
      kind: "all",
      selected: matching.selected,
      total: matching.total,
      cut: matching.total > matching.selected,
    }
  }
  const reachable = Math.min(total, SELECT_ALL_LIMIT)
  if (
    args.allPageRowsSelected &&
    args.pageRowCount > 0 &&
    total > args.pageRowCount &&
    selectedCount < reachable
  ) {
    return {
      kind: "offer",
      pageCount: args.pageRowCount,
      total,
      limit: total > SELECT_ALL_LIMIT ? SELECT_ALL_LIMIT : null,
    }
  }
  return null
}
