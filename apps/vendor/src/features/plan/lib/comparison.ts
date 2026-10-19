import type {
  CapabilityEntry,
  PlanCapabilityEntry,
  PlanComparisonEntry,
} from "../types"

/**
 * The pricing table's model.
 *
 * The catalog supplies the rows and the matrix supplies the cells, so the table
 * is entirely server-described: a capability added next month becomes a new row
 * in its own group with no change here. Nothing in this file knows a capability
 * by name.
 */

/**
 * What one plan grants for one capability.
 *
 * `excluded` and `amount: 0` are different answers and must stay so — a tier
 * that does not sell a capability shows a dash, a tier that sells you none of
 * it shows a zero. Collapsing them is how a comparison table starts lying.
 */
export type CellValue =
  | { kind: "included" }
  | { kind: "excluded" }
  | { kind: "unlimited" }
  | { kind: "amount"; value: number }

/** A section of the table — one `group` from the catalog, in catalog order. */
export interface ComparisonGroup {
  group: string
  capabilities: CapabilityEntry[]
}

/** Plan id -> feature key -> what that plan grants. */
export type ComparisonMatrix = Map<string, Map<string, PlanCapabilityEntry>>

export function buildMatrix(rows: PlanComparisonEntry[]): ComparisonMatrix {
  const matrix: ComparisonMatrix = new Map()
  for (const row of rows) {
    matrix.set(
      row.plan_id,
      new Map(row.capabilities.map((c) => [c.feature_key, c])),
    )
  }
  return matrix
}

/**
 * Group the catalog the way the table sections it.
 *
 * Insertion order is kept rather than sorted alphabetically: the server already
 * orders by `group` then `sort_order`, and that ordering is the product's, not
 * this file's, to decide.
 */
export function groupCatalog(catalog: CapabilityEntry[]): ComparisonGroup[] {
  const groups = new Map<string, CapabilityEntry[]>()
  for (const capability of catalog) {
    const list = groups.get(capability.group) ?? []
    list.push(capability)
    groups.set(capability.group, list)
  }
  return [...groups.entries()].map(([group, capabilities]) => ({
    group,
    capabilities,
  }))
}

/**
 * One cell.
 *
 * **A capability absent from a plan's rows is excluded, not unlimited.** The
 * server denies a missing entitlement, so the table has to agree or it will
 * advertise something checkout does not deliver.
 */
export function cellFor(
  capability: CapabilityEntry,
  granted: PlanCapabilityEntry | undefined,
): CellValue {
  if (!granted || !granted.enabled) return { kind: "excluded" }
  if (capability.kind === "BOOLEAN") return { kind: "included" }
  if (granted.limit_value === null || granted.limit_value === undefined) {
    return { kind: "unlimited" }
  }
  return { kind: "amount", value: granted.limit_value }
}

/** True when a row would be a dash across every column — nothing to show. */
export function isEmptyRow(cells: CellValue[]): boolean {
  return cells.every((c) => c.kind === "excluded")
}

/**
 * Rank a cell so "more" can be compared across kinds. Only used to decide what
 * a tier ADDS over the one below it, never rendered.
 */
function rank(cell: CellValue): number {
  switch (cell.kind) {
    case "excluded":
      return -1
    case "amount":
      return cell.value
    case "included":
      return 1
    case "unlimited":
      return Number.POSITIVE_INFINITY
  }
}

export interface Highlight {
  capability: CapabilityEntry
  cell: CellValue
}

/**
 * The bullets under a plan card: what this tier gives you that the one below it
 * does not.
 *
 * The cheapest tier has nothing to compare against, so it lists what it grants.
 * Every tier after it lists only the upgrades — a bigger ceiling counts, an
 * identical one does not — which is what makes the card read as "and also…"
 * rather than repeating the whole table four times.
 */
export function highlightsFor(
  catalog: CapabilityEntry[],
  granted: Map<string, PlanCapabilityEntry> | undefined,
  previous: Map<string, PlanCapabilityEntry> | undefined,
  limit = 5,
): Highlight[] {
  const out: Highlight[] = []

  for (const capability of catalog) {
    const cell = cellFor(capability, granted?.get(capability.key))
    if (cell.kind === "excluded") continue

    if (previous) {
      const before = cellFor(capability, previous.get(capability.key))
      if (rank(cell) <= rank(before)) continue
    }

    out.push({ capability, cell })
    if (out.length >= limit) break
  }

  return out
}
