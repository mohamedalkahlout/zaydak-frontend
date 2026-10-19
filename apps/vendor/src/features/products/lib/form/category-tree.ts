import type { SystemCategory } from "@/features/products/types"

/**
 * Turning the flat taxonomy into something you can walk a level at a time.
 *
 * `systemCategoriesFlat` returns all ~5,600 nodes with `parent_id` and `level`,
 * which is everything a drill-down needs — so browsing costs no extra query and
 * no new back-end. It is indexed once per mount and read from there.
 *
 * The order inside a level is the order the server sent, which is the
 * taxonomy's own `sort_order`. Re-sorting alphabetically here would look
 * tidier and would quietly disagree with every other surface that renders the
 * same tree.
 */
export interface CategoryIndex {
  /** Children of a node id; roots live under `ROOT_KEY`. */
  childrenOf: (parentId: string | null) => SystemCategory[]
  byId: (id: string) => SystemCategory | undefined
  hasChildren: (id: string) => boolean
}

const ROOT_KEY = "__root__"

export function buildCategoryIndex(nodes: SystemCategory[]): CategoryIndex {
  const children = new Map<string, SystemCategory[]>()
  const byId = new Map<string, SystemCategory>()

  for (const node of nodes) {
    byId.set(node.id, node)
    const key = node.parent_id ?? ROOT_KEY
    const bucket = children.get(key)
    if (bucket) bucket.push(node)
    else children.set(key, [node])
  }

  return {
    childrenOf: (parentId) => children.get(parentId ?? ROOT_KEY) ?? [],
    byId: (id) => byId.get(id),
    hasChildren: (id) => (children.get(id)?.length ?? 0) > 0,
  }
}

/**
 * The chain from the root down to `id`, inclusive — the drill path that would
 * have produced this node.
 *
 * Used to open the picker where the merchant left off rather than back at the
 * 21 roots, which on an edit is the difference between "confirm this is right"
 * and "find it again". Walks `parent_id` rather than splitting `path`, because
 * `path` is built from slugs and the ids are what the UI addresses.
 *
 * Defends against a cycle: a malformed tree would otherwise hang the render,
 * and the taxonomy is seeded data that a bad import could in principle corrupt.
 */
export function ancestorChain(
  index: CategoryIndex,
  id: string | null | undefined,
): SystemCategory[] {
  const chain: SystemCategory[] = []
  const seen = new Set<string>()
  let cursor = id ? index.byId(id) : undefined

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    chain.unshift(cursor)
    cursor = cursor.parent_id ? index.byId(cursor.parent_id) : undefined
  }

  return chain
}
