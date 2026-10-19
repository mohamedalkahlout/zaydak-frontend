/**
 * Human text for a cart line's `unavailable_reason` code.
 *
 * The API returns stable machine codes (`out_of_stock`, `product_deleted`, …).
 * Showing the code itself — which the mini-cart used to do — is what painted
 * a red `out_of_stock` under every untracked line before the pricing gate
 * was fixed. Unknown codes fall back to the generic "Unavailable" string.
 */
export function unavailableReasonLabel(
  reason: string | null | undefined,
  t: { (key: string): string; has: (key: string) => boolean },
): string {
  if (!reason) return t("unavailable")
  const key = `reasons.${reason}`
  return t.has(key) ? t(key) : t("unavailable")
}
