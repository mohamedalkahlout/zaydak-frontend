"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { AddressFields } from "@/features/addresses/components/address-fields"
import { AddressTiles } from "@/features/addresses/components/address-tiles"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { CouponTicket } from "@/features/cart/components/coupon-ticket"
import { useCart } from "@/features/cart/use-cart"
import { formatMoney } from "@/shared/lib/format"
import type { CheckoutReady } from "../use-checkout"
import { isDigitalOnlyOrder } from "../lib/shipping"
import { ShippingMethodPicker } from "./checkout-page"

export function TemplateCheckoutFields({ session }: { session: CheckoutReady }) {
  const t = useTranslations("checkout")
  const tBank = useTranslations("bankTransfer")
  const openAuth = useAuthDialogStore((s) => s.open)
  const hint =
    session.payment === "BANK_TRANSFER"
      ? t("paymentBankHint")
      : session.payment === "STRIPE"
        ? t("paymentCardHint")
        : session.payment === "CASH_ON_DELIVERY"
          ? t("paymentCodHint")
          : null

  return (
    <div className="tpl-stack">
      {(session.blockedCount > 0 || session.quoteBlockedIds.size > 0) && (
        <div className="tpl-warn" role="alert">
          <p>{t("unavailableTitle")}</p>
          {session.blockedNames.length > 0 && (
            <ul>
              {session.blockedNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
          <p>{t("unavailableBody")}</p>
        </div>
      )}

      <label className="tpl-label" htmlFor="tpl-name">
        {t("customerName")}
        <input
          id="tpl-name"
          value={session.customerName}
          autoComplete="name"
          onChange={(event) => session.handleCustomerNameChange(event.target.value)}
        />
      </label>
      <label className="tpl-label" htmlFor="tpl-contact">
        {t("customerContact")}
        <input
          id="tpl-contact"
          value={session.contact}
          autoComplete="email"
          onChange={(event) => session.handleContactChange(event.target.value)}
          onBlur={session.handleContactBlur}
        />
      </label>
      {session.contactError ? <p className="tpl-error">{session.contactError}</p> : null}
      <p className="tpl-note">{t("contactHelp")}</p>

      {session.needsShipping ? (
        <>
          <AddressTiles value={session.address} onChange={session.handleAddressChange} />
          <AddressFields
            value={session.address}
            onChange={session.handleAddressChange}
            idPrefix="tpl-checkout"
          />
          {(session.shippingOptions.length > 0 || session.quote?.carrier_unavailable_reason) && (
            <ShippingMethodPicker
              options={session.shippingOptions}
              selectedId={session.selectedOptionId}
              onSelect={session.handleShippingRuleSelect}
              currency={session.activeCurrency}
              disabled={session.placing}
              carrierUnavailableReason={session.quote?.carrier_unavailable_reason}
            />
          )}
          {session.quote?.fulfillment.requires_split && (
            <p className="tpl-note">{t("arrivesInMultipleDeliveries")}</p>
          )}
          {session.destinationExcluded ? (
            <p className="tpl-error">{t("shippingExcluded")}</p>
          ) : session.shippingUnpriced ? (
            <p className="tpl-warn">{t("shippingUnpriced")}</p>
          ) : null}
        </>
      ) : isDigitalOnlyOrder(session.orderable) ? (
        <p className="tpl-note">{t("digitalOnly")}</p>
      ) : null}

      <div className="tpl-row" role="group" aria-label={t("payment")}>
        {session.paymentOptions.methods.map((method) => (
          <button
            key={method}
            type="button"
            className="tpl-pay"
            aria-pressed={session.payment === method}
            onClick={() => session.handlePaymentChange(method)}
          >
            {method === "BANK_TRANSFER"
              ? t("paymentBank")
              : method === "CASH_ON_DELIVERY"
                ? t("paymentCod")
                : t("paymentCard")}
          </button>
        ))}
      </div>
      {hint ? <p className="tpl-note">{hint}</p> : null}
      {session.paymentOptions.loading && !session.payment ? (
        <p className="tpl-note">{tBank("loading")}</p>
      ) : null}
      {session.paymentOptions.error ? (
        <div className="tpl-error" role="alert">
          <p>{t("paymentOptionsError")}</p>
          <button type="button" className="tpl-pay" onClick={session.handleRefetchPaymentOptions}>
            {tBank("retry")}
          </button>
        </div>
      ) : !session.paymentOptions.loading && !session.payment ? (
        <p className="tpl-note">{t("noPaymentMethods")}</p>
      ) : null}

      {session.payment === "BANK_TRANSFER" && (
        <div className="tpl-stack">
          <p className="tpl-label">{tBank("chooseAccount")}</p>
          {!session.isAuthenticated ? (
            <button type="button" className="tpl-pay" onClick={() => openAuth()}>
              {tBank("signIn")}
            </button>
          ) : session.bankAccounts.loading ? (
            <p className="tpl-note">{tBank("loading")}</p>
          ) : session.bankAccounts.error ? (
            <div className="tpl-error" role="alert">
              <p>{tBank("loadError")}</p>
              <button type="button" className="tpl-pay" onClick={session.handleRefetchBankAccounts}>
                {tBank("retry")}
              </button>
            </div>
          ) : session.accounts.length === 0 ? (
            <p className="tpl-note">{tBank("noAccounts")}</p>
          ) : (
            <>
              <select
                id="tpl-bank"
                value={session.selectedBankAccount?.id ?? ""}
                onChange={(event) => session.handleBankAccountIdChange(event.target.value)}
              >
                {session.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank_name ||
                      session.bankNameMap[account.bank_code] ||
                      account.bank_code}{" "}
                    · {account.iban.slice(-4)}
                  </option>
                ))}
              </select>
              <p className="tpl-note">{tBank("payAfterOrder")}</p>
            </>
          )}
        </div>
      )}

      <label className="tpl-label" htmlFor="tpl-note">
        {t("note")}
        <textarea
          id="tpl-note"
          rows={3}
          value={session.note}
          placeholder={t("notePlaceholder")}
          onChange={(event) => session.handleNoteChange(event.target.value)}
        />
      </label>
      <CouponField currency={session.activeCurrency} />
    </div>
  )
}

function CouponField({ currency }: { currency: string | null }) {
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
    <div className="tpl-stack">
      <label className="tpl-label" htmlFor="tpl-coupon">
        {tCheckout("discountCode")}
        <input
          id="tpl-coupon"
          value={code}
          placeholder={t("couponPlaceholder")}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void apply()
            }
          }}
        />
      </label>
      <button type="button" className="tpl-pay" disabled={mutating || !code.trim()} onClick={() => void apply()}>
        {t("applyCoupon")}
      </button>
      {coupons.map((coupon) => (
        <CouponTicket
          key={coupon.id}
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
      ))}
    </div>
  )
}
