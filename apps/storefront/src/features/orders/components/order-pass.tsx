import { Package } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { BoardingPass } from "@repo/ui/components/boarding-pass"

import AppImage from "@/shared/components/app-image"
import { formatCount, formatDate, formatMoney } from "@/shared/lib/format"
import { imageRef } from "@/shared/lib/multilang"
import { readAddress } from "@/features/addresses/lib/address"
import type { StorefrontOrderQuery } from "@/shared/api/generated/graphql"

type Order = NonNullable<StorefrontOrderQuery["order"]["data"]>

/**
 * The order as a pass — the artifact a customer keeps from a purchase.
 *
 * This is the app-local wrapper `@repo/ui`'s one rule asks for: `BoardingPass`
 * is store-free and translation-free, and everything that knows about orders,
 * money, locales and the shop lives here.
 *
 * The mapping is a shipment, not an imitation of a flight, and every slot had
 * to earn its place:
 *
 * - The **route row carries one endpoint, not two**. A delivery has one place
 *   that matters — where it is going. The origin is the shop, and the shop is
 *   already the brand line above, so a second copy of it only cost both ends
 *   the width they needed to be legible.
 * - The **carrier band is left empty on purpose**, so the component drops it. An
 *   order has no airline, and inventing one ("Standard shipping", say) would be
 *   the exact cosplay this mapping is trying to avoid.
 * - The **stub encodes the tracking number and prints it underneath**, the way
 *   a real ticket does. The bars are `aria-hidden`, so that caption is how the
 *   number reaches a screen reader — and it is the string a customer quotes
 *   back to the shop, so it belongs on the card rather than above it.
 *
 * `delivery.time` is the shop's own free-text estimate and is often absent. It
 * feeds the pill only, and when it is missing the pill is dropped rather than
 * filled with a guess — an invented delivery date is the one thing on this card
 * a customer would hold the shop to.
 */
export function OrderPass({ order }: { order: Order }) {
  const t = useTranslations("orderConfirmation")
  const locale = useLocale()

  const shopName = order.shop?.name ?? ""
  const logo = imageRef(order.shop?.logo)

  // `addresses.shipping` is stored JSON; `readAddress` is the one parser that
  // knows its shape, and it returns an empty address rather than throwing on
  // an order placed before a field existed.
  const shipping = readAddress(order.addresses?.shipping)

  const eta = order.delivery?.time?.trim() || ""

  const itemCount = order.products.reduce(
    (sum, product) => sum + product.order_quantity,
    0,
  )

  return (
    <BoardingPass
      brand={shopName}
      logo={
        logo ? (
          <AppImage
            src={logo.thumbnail ?? logo.original}
            alt=""
            width={22}
            height={22}
            className="size-[22px] rounded-full object-cover ring-1 ring-white/30"
          />
        ) : undefined
      }
      /*
        One endpoint, not two. The origin is the shop, and the shop's name is
        already the brand line at the top of this card — printing it again in a
        30px slot beside the destination meant BOTH ends truncated to
        "Ahmed Elect…" and "Riy…", which is the same information twice and
        neither of them readable. With `from` omitted the row gives its whole
        width to where the parcel is going, and a place name fits where a
        three-letter airport code used to.

        No `time` either: an order has no departure clock, a date is too long
        for that slot and an ETA is a phrase. The date is in the detail band and
        the estimate is in the pill, which is 9px and can hold one.
      */
      to={{ city: t("passTo"), code: shipping.city }}
      duration={eta || undefined}
      durationIcon={<Package className="size-2.5" strokeWidth={2.5} />}
      passengerLabel={t("passRecipient")}
      passengerName={order.customer?.name ?? ""}
      details={[
        { label: t("passOrdered"), value: formatDate(order.created_at, locale) },
        { label: t("passItems"), value: formatCount(itemCount, locale) },
        {
          label: t("passTotal"),
          value: formatMoney(
            order.pricing.total_cents,
            order.currency,
            locale,
            { narrow: true },
          ),
        },
      ]}
      stubCaption={order.tracking_number}
      barcodeValue={order.tracking_number}
    />
  )
}
