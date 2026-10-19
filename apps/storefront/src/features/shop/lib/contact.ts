/**
 * How a shop's published contact details become links.
 *
 * The one thing worth knowing before touching either caller: **`ShopSettings`
 * carries `contact` and `email` as two different fields**, and the vendor
 * dashboard labels them "Phone number" and "Store contact email"
 * (`apps/vendor/src/features/settings/components/store-contact-pane.tsx`). Both
 * the footer and the home page's shop panel used to `mailto:` the *phone*,
 * which composed a message to an address that cannot exist and looked correct
 * in every screenshot. Anything reading `settings.contact` wants `tel:`.
 *
 * ## The contact form sits beside these links, it does not replace them
 *
 * `/[shopSlug]/contact` (`features/contact/`) now posts an anonymous message
 * straight into the merchant's inbox, which is a better route than a `mailto:`
 * for almost everybody. The published `mailto:` and `tel:` rows stay anyway,
 * for three reasons, and the first is the one that settles it:
 *
 *  - **The form exists for every shop; these rows do not.** They are rendered
 *    only when a vendor filled the field in. Replacing a row that may be absent
 *    with a link that is always there is an upgrade; replacing a link that is
 *    always there with rows that may be absent would leave some shops with no
 *    way to be reached at all.
 *  - **The address is evidence, not just a destination.** A shopper deciding
 *    whether to trust a storefront reads where the mail would go before they
 *    click, which is why the footer prints the address itself rather than the
 *    word "Contact". A form shows them nothing.
 *  - **A `mailto:` leaves the sender a copy.** What goes through the form lands
 *    in the merchant's inbox and nowhere the sender can look again; a message
 *    they sent themselves is in their own Sent folder. For "where is my order"
 *    that difference is the whole record of the conversation.
 *
 * A phone number is not a substitute for either and never was: it is the
 * channel for somebody who wants an answer now.
 */

/**
 * A phone number as a `tel:` target.
 *
 * `settings.contact` is free text a vendor typed into a field with no format
 * validation, so it arrives as "+1 855-987-4420 (toll-free)" as readily as
 * "0551234567". Everything but the digits and a leading `+` is stripped for the
 * href while the vendor's own formatting stays on screen — which is the right
 * split, because the punctuation is what makes a number readable and the
 * absence of it is what makes it dialable.
 *
 * The `+` is kept only when the vendor wrote one: prepending it to a local
 * number would assert a country code that is not there.
 */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "")
  return phone.trim().startsWith("+") ? `+${digits}` : digits
}
