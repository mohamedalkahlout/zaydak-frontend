/**
 * Resolve the first few entity names from a selected-ids list using the
 * snapshots map pre-loaded from `coupon(id)`. Returns `undefined` when no
 * snapshots are available so `ScopePreview` falls back to its default hint.
 */
export function pickPreviewNames(
  ids: readonly string[] | null | undefined,
  snapshot: Record<string, { name: string }> | undefined,
): string[] | undefined {
  if (!snapshot || !ids || ids.length === 0) return undefined
  const names: string[] = []
  for (const id of ids) {
    const entry = snapshot[id]
    if (entry?.name) names.push(entry.name)
    if (names.length >= 3) break
  }
  return names.length > 0 ? names : undefined
}
