import { HulloShopHome } from "./hullo-shop-home"

/**
 * The public home when the shop's template is hullo. It owns the document
 * scroll, so the shop layout renders it without the default header and footer.
 * The menu is the shop's catalogue. Checkout writes the shop cart.
 */
export function HulloStorefrontHome() {
  return <HulloShopHome />
}
