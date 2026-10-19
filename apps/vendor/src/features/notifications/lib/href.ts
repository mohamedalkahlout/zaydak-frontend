import type { NotifyLogEntry } from "../types"

/**
 * Where a notification takes you. `entity_id` is already the identifier that
 * entity's route is keyed on — an order's id, a product's slug. A row with no
 * entity, or an entity type this dashboard has no page for, isn't a link.
 *
 * Refunds deliberately resolve to their order: the vendor dashboard has no
 * refund detail route, and the order page is where a refund is acted on.
 *
 * `plan` is the one type whose route ignores `entity_id`. The plan page lives
 * outside the dashboard chrome at `/plan/:shopSlug` and is keyed on the slug,
 * while the notification carries a shop **id** — so the link is built from the
 * active slug like every other row here. That also makes it the destination for
 * a billing notification whichever store the vendor happens to have open, which
 * is right: the fix for every one of them is on that page.
 */
export function hrefFor(
  n: Pick<NotifyLogEntry, "entity_type" | "entity_id">,
  shopSlug: string | null,
): string | null {
  if (!shopSlug || !n.entity_type || !n.entity_id) return null
  switch (n.entity_type) {
    case "order":
      return `/store/${shopSlug}/orders/${n.entity_id}`
    case "product":
      return `/store/${shopSlug}/products/${n.entity_id}/edit`
    case "plan":
      return `/plan/${shopSlug}`
    default:
      return null
  }
}
