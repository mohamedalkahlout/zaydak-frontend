/**
 * The vendor assistant, as data only.
 *
 * There is no screen and no component here any more. The handset is enrolled
 * by the back-end when the vendor connects their shop's WhatsApp, so there was
 * never anything for a dedicated settings page to *do* — what remained of it
 * (which phone, which shop, and unlinking) is three lines, and they belong
 * beside the number they are about, on the WhatsApp screen's assistant card.
 *
 * The operations and types stay their own feature rather than moving into
 * `whatsapp/`: they are account-scoped and carry no `X-SHOP` meaning, which is
 * the one thing that must not blur into a feature where everything else is
 * shop-scoped.
 */
export * from "./api"
export * from "./types"
