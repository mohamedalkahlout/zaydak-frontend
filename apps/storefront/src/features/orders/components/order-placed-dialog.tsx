import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/dialog"

import type { StorefrontOrderQuery } from "@/shared/api/generated/graphql"
import { OrderPass } from "./order-pass"

type Order = NonNullable<StorefrontOrderQuery["order"]["data"]>

/**
 * The confirmation, as a popup over the order it confirms.
 *
 * Closing it leaves the customer on the full order screen rather than on an
 * empty "thanks" page, which is why this is a dialog and not a route: there is
 * nowhere to go back to, and the thing behind it is already the right thing.
 *
 * Two decisions worth keeping:
 *
 * - **The ground is ink, not the popover's paper.** The pass carries its own
 *   fixed palette, and on the app's warm paper it read as a stray swatch; on
 *   ink it reads as an object placed on a surface, which is what it is. The
 *   dark ground is `BoardingPass`'s own — the dialog itself is transparent, and
 *   this note used to claim it borrowed `--shop-footer-*`, which it never did
 *   and which those tokens could not supply anyway now that the footer is a
 *   light slab.
 * - **It never claims the order is paid.** A card order that succeeds comes
 *   back from Stripe to `?placed=1`, usually before the payment's webhook has
 *   landed — so even there `financial_status` can still read unpaid, and a
 *   green tick would be asserting a state the column does not hold yet.
 */
export function OrderPlacedDialog({
  order,
  shopName,
  open,
  onClose,
}: {
  order: Order
  shopName: string
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations("orderConfirmation")
  const paid = order.financial_status.toLowerCase() === "paid"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        /*
          `ring-0` is the one that matters. `DialogContent` paints its box with
          `ring-1 ring-foreground/10`, not a border — so `border-none` left the
          rounded outline sitting around the card, and `sm:max-w-sm` made that
          outline wider than the card it framed. Sized to the pass instead, with
          nothing painted: the card is the popup.
        */
        className="w-80 max-w-[calc(100%-2rem)] gap-3 border-0 bg-transparent p-0 shadow-none outline-none ring-0"
      >
        {/*
          Both `sr-only`. The dialog still needs an accessible name, and the
          sentence still has to name the shop and the order for a screen reader
          — but the sighted reading of all of it is the card. This began as a
          2xl headline over a subtitle over an order number over the pass: four
          stacked blocks, three repeating the fourth.
        */}
        <DialogTitle className="sr-only">
          {t("heroTitle", { shop: shopName })}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("subtitle", {
            tracking: order.tracking_number,
            shop: shopName,
          })}
        </DialogDescription>

        <div className="relative">
          <OrderPass order={order} />

          {/*
            The close sits in the striped header, which is the one part of the
            card that is pure decoration — so dismissing costs no vertical space
            and nothing competes with the card underneath it. A labelled button
            below the pass was a second slab under a design whose whole point is
            that it is one object. The label survives as the accessible name.
          */}
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute end-2.5 top-2.5 rounded-full text-white/70 hover:bg-white/15 hover:text-white focus-visible:ring-shop-accent"
              />
            }
          >
            <X className="size-4" />
            <span className="sr-only">{t("viewOrder")}</span>
          </DialogClose>
        </div>

        {/*
          The one fact the card cannot carry. An unpaid order is the ordinary
          case here — cash on delivery, a transfer not yet made, or a card
          payment whose webhook has not landed on the way back from Stripe —
          and saying nothing would let the customer assume the opposite. White
          rather than a token: the ground behind it is the dialog overlay, not
          a surface this app themes.
        */}
        {paid ? null : (
          <p className="text-center text-xs font-medium text-white/80">
            {order.payment.gateway?.toUpperCase() === "BANK_TRANSFER"
              ? t("bankTransferNext")
              : order.payment.gateway?.toUpperCase() === "STRIPE"
                ? t("cardPaymentPending")
                : order.payment.gateway?.toUpperCase() === "INVOICE"
                  ? t("invoicePaymentPending")
                  : t("payLater")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
