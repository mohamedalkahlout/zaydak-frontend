"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { memo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { AtSign, CreditCard, Landmark, Loader2, Lock, Truck } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@repo/ui/lib/utils"

import { formatMoney } from "@/shared/lib/format"
import { shopHomeHref } from "@/shared/lib/tenant"
import { text } from "@/shared/lib/multilang"
import { AddressFields } from "@/features/addresses/components/address-fields"
import { AddressTiles } from "@/features/addresses/components/address-tiles"
import type { Address } from "@/features/addresses/lib/address"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { useShop } from "@/features/shop/shop-context"
import type { PaymentMethod } from "@/features/bank-transfers/use-payment-options"
import { OrderSummary, type CheckoutQuote } from "./order-summary"
import { isDigitalOnlyOrder } from "../lib/shipping"
import { useCheckout } from "../use-checkout"

const FIELD_INPUT =
  "h-11 rounded-xl border-transparent bg-secondary/70 px-3.5 text-sm"

export function CheckoutPage() {
  const t = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const session = useCheckout()

  if (session.status === "loading") return <CheckoutSkeleton />

  if (session.status === "empty") {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <h1 className="relative font-heading text-shop-title font-semibold tracking-tight">
            {t("emptyCart")}
          </h1>
          <Button
            className="relative mt-8 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            nativeButton={false}
            render={<Link href={`${session.base}/products`} />}
          >
            {tCommon("continue")}
          </Button>
        </div>
      </div>
    )
  }

  const {
    shopName,
    logo,
    customerName,
    handleCustomerNameChange,
    contact,
    handleContactChange,
    handleContactBlur,
    contactError,
    needsShipping,
    addressReady,
    address,
    handleAddressChange,
    paymentOptions,
    handleRefetchPaymentOptions,
    payment,
    handlePaymentChange,
    shippingOptions,
    selectedOptionId,
    handleShippingRuleSelect,
    activeCurrency,
    quote,
    destinationExcluded,
    shippingUnpriced,
    isAuthenticated,
    bankAccounts,
    handleRefetchBankAccounts,
    accounts,
    selectedBankAccount,
    bankNameMap,
    handleBankAccountIdChange,
    blockedCount,
    quoteBlockedIds,
    blockedNames,
    canPlace,
    placing,
    handlePlaceOrder,
    actionLabel,
    orderable,
    summary,
    totalCents,
    note,
    handleNoteChange,
    steps,
    currentStep,
    verifying,
    locale,
    isConverted,
    formatDisplayPrice,
  } = session

  return (
    <div className="shop-container py-6 pb-28 lg:py-10 lg:pb-12">
      <div className="rounded-3xl bg-shop-sunken p-3 sm:p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
          <CheckoutForm
            shopName={shopName}
            logo={logo}
            customerName={customerName}
            onCustomerNameChange={handleCustomerNameChange}
            contact={contact}
            onContactChange={handleContactChange}
            onContactBlur={handleContactBlur}
            contactError={contactError}
            needsShipping={needsShipping}
            digitalOnly={isDigitalOnlyOrder(orderable)}
            address={address}
            onAddressChange={handleAddressChange}
            paymentMethods={paymentOptions.methods}
            paymentLoading={paymentOptions.loading}
            paymentError={paymentOptions.error}
            onRefetchPaymentOptions={handleRefetchPaymentOptions}
            payment={payment}
            onPaymentChange={handlePaymentChange}
            shippingOptions={shippingOptions}
            selectedOptionId={selectedOptionId}
            onShippingRuleSelect={handleShippingRuleSelect}
            activeCurrency={activeCurrency}
            carrierUnavailableReason={quote?.carrier_unavailable_reason}
            requiresSplit={quote?.fulfillment.requires_split}
            destinationExcluded={destinationExcluded}
            shippingUnpriced={shippingUnpriced}
            isAuthenticated={isAuthenticated}
            bankAccountsLoading={bankAccounts.loading}
            bankAccountsError={bankAccounts.error}
            onRefetchBankAccounts={handleRefetchBankAccounts}
            accounts={accounts}
            selectedBankAccountId={selectedBankAccount?.id}
            bankNameMap={bankNameMap}
            onBankAccountIdChange={handleBankAccountIdChange}
            blockedCount={blockedCount}
            hasQuoteBlockedIds={quoteBlockedIds.size > 0}
            blockedNames={blockedNames}
            canPlace={canPlace}
            placing={placing}
            onPlaceOrder={handlePlaceOrder}
            actionLabel={actionLabel}
          />

          <aside className="px-1 pb-2 lg:sticky lg:top-24 lg:self-start lg:px-3 lg:pt-6">
            <OrderSummary
              shopName={shopName}
              items={orderable}
              currency={activeCurrency}
              quote={quote}
              fallbackSubtotalCents={summary?.subtotal_price_cents ?? 0}
              totalCents={totalCents}
              needsShipping={needsShipping}
              addressReady={addressReady}
              address={address}
              customerName={customerName}
              contact={contact}
              note={note}
              onNoteChange={handleNoteChange}
              steps={steps}
              currentStep={currentStep}
              verifying={verifying}
            />
          </aside>
        </div>
      </div>

      <MobileActionBar
        tTotal={t("total")}
        verifying={verifying}
        totalCents={totalCents}
        activeCurrency={activeCurrency}
        locale={locale}
        isConverted={isConverted}
        formatDisplayPrice={formatDisplayPrice}
        canPlace={canPlace}
        placing={placing}
        onPlaceOrder={handlePlaceOrder}
        actionLabel={actionLabel}
      />
    </div>
  )
}

interface CheckoutFormProps {
  shopName: string
  logo: string | null
  customerName: string
  onCustomerNameChange: (val: string) => void
  contact: string
  onContactChange: (val: string) => void
  onContactBlur: () => void
  contactError: string | null
  needsShipping: boolean
  /** True only when orderable lines exist and none of them ship. */
  digitalOnly: boolean
  address: Address
  onAddressChange: (addr: Address) => void
  paymentMethods: PaymentMethod[]
  paymentLoading: boolean
  paymentError: unknown
  onRefetchPaymentOptions: () => void
  payment: PaymentMethod | null
  onPaymentChange: (method: PaymentMethod) => void
  shippingOptions: NonNullable<CheckoutQuote>["shipping_options"]
  selectedOptionId: string | null
  onShippingRuleSelect: (id: string) => void
  activeCurrency: string | null
  carrierUnavailableReason?: string | null
  requiresSplit?: boolean
  destinationExcluded: boolean
  shippingUnpriced: boolean
  isAuthenticated: boolean
  bankAccountsLoading: boolean
  bankAccountsError: unknown
  onRefetchBankAccounts: () => void
  accounts: Array<{
    id: string
    bank_name?: string | null
    bank_code: string
    iban: string
  }>
  selectedBankAccountId?: string
  bankNameMap: Record<string, string>
  onBankAccountIdChange: (id: string) => void
  blockedCount: number
  hasQuoteBlockedIds: boolean
  blockedNames: string[]
  canPlace: boolean
  placing: boolean
  onPlaceOrder: () => void
  actionLabel: string
}

const CheckoutForm = memo(function CheckoutForm({
  shopName,
  logo,
  customerName,
  onCustomerNameChange,
  contact,
  onContactChange,
  onContactBlur,
  contactError,
  needsShipping,
  digitalOnly,
  address,
  onAddressChange,
  paymentMethods,
  paymentLoading,
  paymentError,
  onRefetchPaymentOptions,
  payment,
  onPaymentChange,
  shippingOptions,
  selectedOptionId,
  onShippingRuleSelect,
  activeCurrency,
  carrierUnavailableReason,
  requiresSplit,
  destinationExcluded,
  shippingUnpriced,
  isAuthenticated,
  bankAccountsLoading,
  bankAccountsError,
  onRefetchBankAccounts,
  accounts,
  selectedBankAccountId,
  bankNameMap,
  onBankAccountIdChange,
  blockedCount,
  hasQuoteBlockedIds,
  blockedNames,
  canPlace,
  placing,
  onPlaceOrder,
  actionLabel,
}: CheckoutFormProps) {
  const t = useTranslations("checkout")
  const tBank = useTranslations("bankTransfer")
  const { base } = useShop()
  // Picking a bank account is halfway down a filled-in form. Sending the
  // shopper to `/login` for it would throw away everything above it, so this
  // one opens the popup and the form is still there underneath.
  const openAuth = useAuthDialogStore((s) => s.open)

  return (
    <section className="shop-panel p-6 sm:p-8 lg:p-10">
      <div className="flex items-center justify-between gap-3">
        <ShopMark name={shopName} logo={logo} />
        <AccountChip name={customerName} />
      </div>

      <div className="mt-8 flex items-start justify-between gap-4">
        <h1 className="font-heading text-shop-title font-semibold tracking-tight">
          {t("title")}
        </h1>
        <div className="hidden shrink-0 text-end sm:block">
          <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-shop-accent">
            <Lock className="size-3.5" />
            {t("secureBadge")}
          </p>
          <p className="mt-1 max-w-[13rem] text-xs leading-snug text-muted-foreground">
            {t("secureNote")}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-shop-hairline">
        {paymentMethods.map((method) => (
          <MethodTab
            key={method}
            method={method}
            selected={payment === method}
            onSelect={() => onPaymentChange(method)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {payment === "BANK_TRANSFER"
          ? t("paymentBankHint")
          : payment === "STRIPE"
            ? t("paymentCardHint")
            : payment === "CASH_ON_DELIVERY"
              ? t("paymentCodHint")
              : null}
      </p>
      {paymentLoading && !payment && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {tBank("loading")}
        </p>
      )}
      {paymentError ? (
        <div role="alert" className="mt-3 space-y-2 text-sm">
          <p>{t("paymentOptionsError")}</p>
          <Button variant="outline" onClick={onRefetchPaymentOptions}>
            {tBank("retry")}
          </Button>
        </div>
      ) : !paymentLoading && !payment ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t("noPaymentMethods")}
        </p>
      ) : null}

      {(blockedCount > 0 || hasQuoteBlockedIds) && (
        <div className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">{t("unavailableTitle")}</p>
          {blockedNames.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 ps-5 font-medium">
              {blockedNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
          <p className="mt-1">{t("unavailableBody")}</p>
          <Link
            href={`${base}/cart`}
            className="mt-2 inline-block font-medium text-shop-accent underline"
          >
            {t("backToCart")}
          </Link>
        </div>
      )}

      <div
        className={cn(
          "mt-7 grid gap-6",
          needsShipping && "sm:grid-cols-[10.5rem_minmax(0,1fr)]",
        )}
      >
        {needsShipping && (
          <AddressTiles value={address} onChange={onAddressChange} />
        )}

        <div className="flex flex-col gap-4">
          <FormField
            id="customer-name"
            label={t("customerName")}
            value={customerName}
            onChange={onCustomerNameChange}
            autoComplete="name"
          />
          <FormField
            id="customer-contact"
            label={t("customerContact")}
            value={contact}
            onChange={onContactChange}
            onBlur={onContactBlur}
            autoComplete="email"
            Icon={AtSign}
            error={contactError}
            helpText={t("contactHelp")}
          />

          {needsShipping ? (
            <AddressFields
              value={address}
              onChange={onAddressChange}
              idPrefix="checkout"
              inputClassName={FIELD_INPUT}
            />
          ) : digitalOnly ? (
            <p className="rounded-xl bg-secondary/60 px-3.5 py-3 text-sm text-muted-foreground">
              {t("digitalOnly")}
            </p>
          ) : null}

          {needsShipping &&
            (shippingOptions.length > 0 || carrierUnavailableReason) && (
              <ShippingMethodPicker
                options={shippingOptions}
                selectedId={selectedOptionId}
                onSelect={onShippingRuleSelect}
                currency={activeCurrency}
                disabled={placing}
                carrierUnavailableReason={carrierUnavailableReason}
              />
            )}

          {needsShipping && requiresSplit && (
            <p className="rounded-xl bg-secondary/60 px-3.5 py-3 text-sm text-muted-foreground">
              {t("arrivesInMultipleDeliveries")}
            </p>
          )}

          {destinationExcluded ? (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              {t("shippingExcluded")}
            </p>
          ) : shippingUnpriced ? (
            <p className="rounded-xl bg-shop-low-stock/10 px-3.5 py-3 text-sm text-foreground">
              {t("shippingUnpriced")}
            </p>
          ) : null}

          {payment === "BANK_TRANSFER" && (
            <div className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-4">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold">
                  {tBank("chooseAccount")}
                </span>
              </div>
              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => openAuth()}
                  className="cursor-pointer text-start text-sm underline"
                >
                  {tBank("signIn")}
                </button>
              ) : bankAccountsLoading ? (
                <p
                  role="status"
                  className="text-sm text-muted-foreground"
                >
                  {tBank("loading")}
                </p>
              ) : bankAccountsError ? (
                <div role="alert" className="space-y-2 text-sm">
                  <p>{tBank("loadError")}</p>
                  <Button
                    variant="outline"
                    onClick={onRefetchBankAccounts}
                  >
                    {tBank("retry")}
                  </Button>
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tBank("noAccounts")}
                </p>
              ) : (
                <>
                  <select
                    id="bank-account"
                    value={selectedBankAccountId ?? ""}
                    onChange={(event) =>
                      onBankAccountIdChange(event.target.value)
                    }
                    className="h-11 w-full cursor-pointer rounded-xl border border-shop-hairline bg-card px-3.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/50"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name ||
                          bankNameMap[account.bank_code] ||
                          account.bank_code}{" "}
                        · {account.iban.slice(-4)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {tBank("payAfterOrder")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-9 hidden items-center gap-5 lg:flex">
        <PlaceOrderButton
          disabled={!canPlace}
          placing={placing}
          onClick={onPlaceOrder}
          label={actionLabel}
        />
        <Link
          href={`${base}/cart`}
          className="text-sm text-muted-foreground transition-colors hover:text-shop-accent"
        >
          {t("cancelReturn")}
        </Link>
      </div>
    </section>
  )
})

interface MobileActionBarProps {
  tTotal: string
  verifying: boolean
  totalCents: number
  activeCurrency: string | null
  locale: string
  isConverted: boolean
  formatDisplayPrice: (cents: number, locale: string) => string
  canPlace: boolean
  placing: boolean
  onPlaceOrder: () => void
  actionLabel: string
}

const MobileActionBar = memo(function MobileActionBar({
  tTotal,
  verifying,
  totalCents,
  activeCurrency,
  locale,
  isConverted,
  formatDisplayPrice,
  canPlace,
  placing,
  onPlaceOrder,
  actionLabel,
}: MobileActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-shop-hairline bg-card/95 p-3 backdrop-blur lg:hidden">
      <div className="shop-container flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{tTotal}</p>
            {verifying && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <p
            className={cn(
              "truncate font-heading text-lg font-semibold tabular-nums transition-opacity duration-200",
              verifying && "opacity-60",
            )}
          >
            {formatMoney(totalCents, activeCurrency, locale)}
          </p>
          {isConverted && (
            <p className="truncate text-[0.6875rem] text-muted-foreground tabular-nums">
              ~{formatDisplayPrice(totalCents, locale)}
            </p>
          )}
        </div>
        <PlaceOrderButton
          className="ms-auto flex-1"
          disabled={!canPlace}
          placing={placing}
          onClick={onPlaceOrder}
          label={actionLabel}
        />
      </div>
    </div>
  )
})

const ShopMark = memo(function ShopMark({
  name,
  logo,
}: {
  name: string
  logo: string | null
}) {
  const { base } = useShop()

  return (
    <Link
      href={shopHomeHref(base)}
      className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-shop-hairline"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate font-heading text-base font-semibold tracking-tight">
        {name}
      </span>
    </Link>
  )
})

const AccountChip = memo(function AccountChip({
  name,
}: {
  name: string
}) {
  const t = useTranslations("shop")
  const { base } = useShop()

  if (!name) return null

  return (
    <Link
      href={`${base}/account`}
      aria-label={t("account")}
      className="flex max-w-[12rem] items-center gap-2 rounded-full bg-secondary/70 py-1 ps-3.5 pe-1 text-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{name}</span>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    </Link>
  )
})

export const ShippingMethodPicker = memo(function ShippingMethodPicker({
  options,
  selectedId,
  onSelect,
  currency,
  disabled,
  carrierUnavailableReason,
}: {
  options: NonNullable<CheckoutQuote>["shipping_options"]
  selectedId: string | null
  onSelect: (id: string) => void
  currency: string | null
  disabled: boolean
  carrierUnavailableReason?: string | null
}) {
  const t = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const locale = useLocale()

  const merchantOptions = options.filter((o) => o.channel !== "carrier")
  const carrierOptions = options.filter((o) => o.channel === "carrier")
  const grouped = merchantOptions.length > 0 && carrierOptions.length > 0

  const renderOption = (
    option: NonNullable<CheckoutQuote>["shipping_options"][number],
  ) => {
    const selected = option.id === selectedId
    const minDays = option.min_delivery_days ?? null
    const maxDays = option.max_delivery_days ?? null
    const eta =
      minDays !== null && maxDays !== null && minDays !== maxDays
        ? t("etaRange", { min: minDays, max: maxDays })
        : minDays !== null || maxDays !== null
          ? t("etaDays", { days: (minDays ?? maxDays) as number })
          : null
    return (
      <label
        key={option.id}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors",
          selected
            ? "bg-secondary ring-1 ring-shop-accent"
            : "bg-secondary/60 hover:bg-secondary/80",
          disabled && "cursor-default opacity-70",
        )}
      >
        <input
          type="radio"
          name="shipping-method"
          value={option.id}
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect(option.id)}
          className="size-4 accent-foreground"
        />
        {option.carrier_logo && (
          <img
            src={option.carrier_logo}
            alt=""
            loading="lazy"
            className="size-8 shrink-0 rounded-md bg-background object-contain p-0.5"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {text(option.name, locale, t("shippingMethodFallback"))}
          </span>
          {eta && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {eta}
            </span>
          )}
          {option.package_count > 1 && (
            <span className="mt-0.5 block text-xs font-medium text-foreground/80">
              {t("splitPackages", { count: option.package_count })}
            </span>
          )}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {option.fee_cents === 0
            ? tCommon("free")
            : formatMoney(option.fee_cents, currency, locale)}
        </span>
      </label>
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
        {t("shippingMethod")}
      </legend>

      {grouped ? (
        <>
          <p className="text-shop-muted mt-1 text-[0.7rem] font-medium uppercase tracking-wide">
            {t("shippingByShop")}
          </p>
          {merchantOptions.map(renderOption)}

          <p className="text-shop-muted mt-2 text-[0.7rem] font-medium uppercase tracking-wide">
            {t("shippingByCarrier")}
          </p>
          {carrierOptions.map(renderOption)}
        </>
      ) : (
        options.map(renderOption)
      )}

      {carrierUnavailableReason === "destination_not_covered" && (
        <p className="text-shop-muted mt-1 text-xs">
          {t("carrierNotCovered")}
        </p>
      )}
      {(carrierUnavailableReason === "location_has_no_city" ||
        carrierUnavailableReason === "no_location" ||
        carrierUnavailableReason === "not_connected" ||
        carrierUnavailableReason === "no_carriers_enabled") && (
        <p className="text-shop-muted mt-1 text-xs">
          {t("carrierNotSetUp")}
        </p>
      )}
    </fieldset>
  )
})

const MethodTab = memo(function MethodTab({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations("checkout")
  const Icon =
    method === "BANK_TRANSFER"
      ? Landmark
      : method === "CASH_ON_DELIVERY"
        ? Truck
        : CreditCard
  const label =
    method === "BANK_TRANSFER"
      ? t("paymentBank")
      : method === "CASH_ON_DELIVERY"
        ? t("paymentCod")
        : t("paymentCard")

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-shop-accent font-medium text-shop-accent"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
})

const PlaceOrderButton = memo(function PlaceOrderButton({
  disabled,
  placing,
  onClick,
  label,
  className,
}: {
  disabled: boolean
  placing: boolean
  onClick: () => void
  label: string
  className?: string
}) {
  const t = useTranslations("checkout")

  return (
    <Button
      size="lg"
      className={cn(
        "h-12 rounded-full bg-shop-accent px-8 text-sm text-shop-accent-foreground hover:bg-shop-accent/90",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {placing ? (
        <>
          <Loader2 className="animate-spin" />
          {t("placing")}
        </>
      ) : (
        label
      )}
    </Button>
  )
})

const FormField = memo(function FormField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  Icon,
  error,
  helpText,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete?: string
  Icon?: React.ComponentType<{ className?: string }>
  error?: string | null
  helpText?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className={cn(
            FIELD_INPUT,
            Icon && "pe-10",
            error && "border-destructive focus-visible:ring-destructive/30",
          )}
        />
        {Icon && (
          <Icon className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      {helpText && !error && (
        <span className="text-[11px] text-muted-foreground">{helpText}</span>
      )}
    </div>
  )
})

const CheckoutSkeleton = memo(function CheckoutSkeleton() {
  return (
    <div className="shop-container py-6 lg:py-10">
      <div className="animate-pulse rounded-3xl bg-shop-sunken p-3 sm:p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
          <div className="h-[32rem] rounded-3xl bg-card ring-1 ring-shop-hairline" />
          <div className="flex flex-col gap-3 lg:pt-6">
            <div className="h-9 w-40 rounded-full bg-muted" />
            <div className="h-14 rounded-2xl bg-muted ring-1 ring-shop-hairline" />
            <div className="h-56 rounded-3xl bg-card ring-1 ring-shop-hairline" />
            <div className="h-14 rounded-3xl bg-card ring-1 ring-shop-hairline" />
          </div>
        </div>
      </div>
    </div>
  )
})
