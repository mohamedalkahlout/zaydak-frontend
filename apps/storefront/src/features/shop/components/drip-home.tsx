import { DRIP_FONTS } from "./drip-fonts"
import { DripShopHome } from "./drip-shop-home"

/**
 * The public home when the shop's template is drip. It owns the document
 * scroll, so the shop layout renders it without the default header and footer.
 * The cone uses the builder's assembly when the shop has one. The bag is
 * the shop cart: add, quantity and remove go through it, and checkout
 * opens that same cart.
 */
export function DripStorefrontHome() {
  return <DripShopHome fonts={DRIP_FONTS} />
}
