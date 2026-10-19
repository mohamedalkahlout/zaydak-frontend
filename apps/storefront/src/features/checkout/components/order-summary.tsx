"use client"

import Image from "@/shared/components/app-image"
import { memo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Loader2,
  Truck,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { cn } from "@repo/ui/lib/utils"

import { formatMoney } from "@/shared/lib/format"
import { useCurrency } from "@/shared/lib/currency/use-currency"
import { imageRef, text } from "@/shared/lib/multilang"
import { formatAddressLines, type Address } from "@/features/addresses/lib/address"
import { CouponTicket } from "@/features/cart/components/coupon-ticket"
import { useCart, type CartLine } from "@/features/cart/use-cart"
import type { StorefrontVerifyCheckoutMutation } from "@/shared/api/generated/graphql"

export type CheckoutQuote =
  StorefrontVerifyCheckoutMutation["verifyCheckout"]["data"]

export interface CheckoutStep {
  key: "delivery" | "payment" | "review"
  done: boolean
}

/**
 * The summary column: what is being bought, where it is going, and what it
 * costs.
 *
 * It is a stack of **collapsible panels** rather than one long list because the
 * three things it holds are consulted at different moments — the basket once at
 * the start, the address once before confirming, the discount box only if there
 * is a code to type. Collapsed, each one still shows its own answer on the
 * header line, so nothing has to be opened to be checked.
 *
 * Every figure comes from `verifyCheckout`. Nothing here adds a fee to a
 * subtotal of its own; when the quote has not arrived the panel falls back to
 * the cart's own totals, which the same server computed.
 */
export const OrderSummary = memo(function OrderSummary({
  shopName,
  items,
  currency,
  quote,
  fallbackSubtotalCents,
  totalCents,
  needsShipping,
  addressReady,
  address,
  customerName,
  contact,
  note,
  onNoteChange,
  steps,
  currentStep,
  verifying,
}: {
  shopName: string
  items: CartLine[]
  currency: string | null
  quote: CheckoutQuote | null
  fallbackSubtotalCents: number
  totalCents: number
  needsShipping: boolean
  addressReady: boolean
  address: Address
  customerName: string
  contact: string
  note: string
  onNoteChange: (next: string) => void
  steps: CheckoutStep[]
  currentStep: number
  verifying: boolean
}) {
  const t = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { isConverted, displayCurrency, formatDisplayPrice } = useCurrency()

  const addressLines = formatAddressLines(address)
  const money = (cents: number) => formatMoney(cents, currency, locale)

  /**
   * The method behind the fee, named on the shipping row — "what am I paying
   * for" should not require scrolling back to the picker. Absent on quotes
   * predating the options list and when nothing ships.
   */
  const selectedShippingOption =
    quote?.shipping_options.find(
      (option) => option.id === quote.selected_shipping_rule_id,
    ) ?? null
  const shippingMethodName = selectedShippingOption
    ? text(selectedShippingOption.name, locale)
    : ""

  /**
   * A fee of 0 reads as "Free" ONLY when the server actually priced the
   * destination. `shipping_available: false` also arrives as fee 0, and
   * rendering that as "Free" — beside the very warning saying no rate was
   * found — was two contradictory messages on one screen.
   */
  const shippingIsFree =
    quote != null && quote.shipping_fee_cents === 0 && quote.shipping_available

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-heading text-shop-title font-semibold tracking-tight">
        {t("summary")}
      </h2>

      <StepRail steps={steps} current={currentStep} />

      <div className="flex flex-col gap-3">
        <SummaryPanel title={shopName} defaultOpen>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <SummaryLine
                key={item.id}
                item={item}
                currency={currency}
                locale={locale}
              />
            ))}
          </ul>

          <dl className="mt-4 flex flex-col gap-2.5 border-t border-shop-hairline pt-3.5 text-sm">
            <Row
              label={t("subtotal")}
              value={money(quote?.subtotal_cents ?? fallbackSubtotalCents)}
              loading={verifying}
            />
            {/* A digital-only order has no shipping line at all — one reading
                "Free" invites the question of what was free. */}
            {needsShipping && (
              <Row
                label={
                  shippingMethodName
                    ? `${t("estimatedShipping")} · ${shippingMethodName}`
                    : t("estimatedShipping")
                }
                value={
                  !addressReady && !quote
                    ? "—"
                    : shippingIsFree
                      ? tCommon("free")
                      : money(quote?.shipping_fee_cents ?? 0)
                }
                loading={verifying}
              />
            )}
            <Row
              label={t("discount")}
              value={
                (quote?.discount_cents ?? 0) > 0
                  ? `− ${money(quote?.discount_cents ?? 0)}`
                  : money(0)
              }
              tone={(quote?.discount_cents ?? 0) > 0 ? "accent" : undefined}
              loading={verifying}
            />
            {(quote?.tax_cents ?? 0) > 0 && (
              <Row
                label={t("tax")}
                value={money(quote?.tax_cents ?? 0)}
                loading={verifying}
              />
            )}
            <Row
              label={t("total")}
              value={money(totalCents)}
              strong
              loading={verifying}
            />
          </dl>
        </SummaryPanel>

        {needsShipping && (
          <SummaryPanel
            title={t("delivery")}
            hint={addressLines[0] ?? t("stepDeliveryHint")}
          >
            <div className="flex flex-col gap-1 text-sm">
              {(customerName || contact) && (
                <p className="font-medium">
                  {[customerName, contact].filter(Boolean).join(" · ")}
                </p>
              )}
              {addressLines.length > 0 ? (
                addressLines.map((line) => (
                  <p key={line} className="text-muted-foreground">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground">{t("stepDeliveryHint")}</p>
              )}
            </div>
          </SummaryPanel>
        )}

        <DiscountPanel currency={currency} />

        <SummaryPanel
          title={t("note")}
          hint={note.trim() || tCommon("optional")}
        >
          <Textarea
            id="order-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={t("notePlaceholder")}
            rows={3}
            aria-label={t("note")}
          />
        </SummaryPanel>
      </div>

      {needsShipping && addressReady && shippingIsFree && (
        <p className="flex items-center gap-2 text-xs font-medium text-shop-in-stock">
          <Truck className="size-3.5" />
          {t("freeShipping")}
        </p>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{`${t("totalAmount")}:`}</span>
        <div className="flex items-center gap-2">
          {verifying && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <span
            className={cn(
              "font-heading text-3xl font-semibold tabular-nums transition-opacity duration-200",
              verifying && "opacity-60",
            )}
          >
            {money(totalCents)}
          </span>
        </div>
      </div>

      {isConverted && (
        <div className="rounded-3xl bg-shop-accent-soft p-3 text-xs text-muted-foreground ring-1 ring-shop-hairline">
          <p className="mb-1 font-semibold text-foreground">
            {tCommon("approximate")}: ~{formatDisplayPrice(totalCents, locale)}
          </p>
          <p>
            {t("currencyNotice", {
              baseCurrency: currency ?? "SAR",
              displayCurrency,
              convertedTotal: `~${formatDisplayPrice(totalCents, locale)}`,
            })}
          </p>
        </div>
      )}
    </div>
  )
})

/**
 * Delivery → Payment → Review, derived rather than stored.
 *
 * The page is a single form — nothing is behind a Next button — so this reads
 * how far the order has got rather than controlling what is visible. A stored
 * step would be a second source of truth able to disagree with the fields
 * directly beside it.
 */
function StepRail({
  steps,
  current,
}: {
  steps: CheckoutStep[]
  current: number
}) {
  const t = useTranslations("checkout")

  const meta = {
    delivery: { label: t("railDelivery"), Icon: Truck, tone: "bg-shop-tile-1 text-shop-tile-1-ink" },
    payment: { label: t("railPayment"), Icon: CreditCard, tone: "bg-shop-tile-2 text-shop-tile-2-ink" },
    review: { label: t("railReview"), Icon: ClipboardCheck, tone: "bg-shop-tile-3 text-shop-tile-3-ink" },
  } as const

  return (
    <ol className="flex items-center justify-between gap-2">
      {steps.map((step, index) => {
        const { label, Icon, tone } = meta[step.key]
        // `current` is -1 once every step is done, and the last one is then the
        // one being acted on — otherwise the rail would highlight nothing at
        // the exact moment the customer is about to confirm.
        const active =
          index === current || (current === -1 && index === steps.length - 1)

        return (
          <li key={step.key} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full transition-opacity",
                tone,
                !active && !step.done && "opacity-45",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[0.625rem] text-muted-foreground">
                {t("step", { number: index + 1 })}
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** One collapsible card in the summary stack. */
function SummaryPanel({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div className="shop-panel overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-5 py-4 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-sm font-semibold tracking-tight">{title}</span>
          {/* The header carries the panel's own answer while it is shut, so
              nothing has to be opened just to be checked. */}
          {hint && !open && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-shop-hairline px-5 pt-3.5 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

function SummaryLine({
  item,
  currency,
  locale,
}: {
  item: CartLine
  currency: string | null
  locale: string
}) {
  const image = imageRef(item.image)

  return (
    <li className="flex items-start gap-3">
      <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline">
        {image ? (
          <Image
            src={image.thumbnail ?? image.original}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : null}
        <span className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[0.625rem] font-semibold tabular-nums text-background">
          {item.quantity}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2-title text-sm leading-snug">{item.name}</p>
        {item.variation_name && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.variation_name}
          </p>
        )}
      </div>
      <span className="shrink-0 font-heading text-sm tabular-nums">
        {formatMoney(item.total_price_cents, currency, locale)}
      </span>
    </li>
  )
}

/**
 * Discount codes, on the checkout as well as on the cart.
 *
 * `applyCartCoupon` writes to the cart, so this is the same operation the cart
 * page runs — which is what keeps one code from being applied in two places
 * with two different results. It lives here because sending a customer back to
 * the cart to type a code they are holding is how a checkout gets abandoned.
 */
function DiscountPanel({ currency }: { currency: string | null }) {
  const t = useTranslations("cart")
  const tCheckout = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { summary, applyCoupon, removeCoupon, mutating } = useCart()

  const [code, setCode] = useState("")
  const coupons = summary?.coupons ?? []

  async function apply() {
    if (!code.trim()) return
    try {
      await applyCoupon(code.trim())
      setCode("")
      sileo.success({ title: t("couponApplied") })
    } catch (error) {
      sileo.error({
        title: tCommon("somethingWentWrong"),
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <SummaryPanel
      title={tCheckout("discountCode")}
      hint={
        coupons.length > 0
          ? coupons.map((coupon) => coupon.code).join(", ")
          : tCommon("optional")
      }
      defaultOpen={coupons.length > 0}
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void apply()
              }
            }}
            placeholder={t("couponPlaceholder")}
            aria-label={t("couponPlaceholder")}
            className="h-9"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
            disabled={mutating || !code.trim()}
            onClick={apply}
          >
            {t("applyCoupon")}
          </Button>
        </div>

        {coupons.length > 0 && (
          <ul className="flex flex-col gap-2">
            {coupons.map((coupon) => (
              <li key={coupon.id}>
                <CouponTicket
                  code={coupon.code}
                  amount={formatMoney(coupon.discount_cents, currency, locale)}
                  label={t("couponApplied")}
                  removeLabel={t("removeCoupon")}
                  disabled={mutating}
                  onRemove={async () => {
                    await removeCoupon(coupon.id)
                    sileo.success({ title: t("couponRemoved") })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </SummaryPanel>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
  loading,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
  tone?: "accent"
  loading?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-heading font-semibold" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={cn(
          "inline-flex items-center gap-1.5 tabular-nums transition-opacity duration-200",
          strong && "font-heading font-semibold",
          tone === "accent" && "text-shop-in-stock",
          loading && "opacity-60",
        )}
      >
        {loading && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
        <span>{value}</span>
      </dd>
    </div>
  )
}
