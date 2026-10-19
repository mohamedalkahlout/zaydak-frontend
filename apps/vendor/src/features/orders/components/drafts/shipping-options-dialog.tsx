"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useMutation, useQuery } from "@apollo/client/react"
import { Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group"
import { cn } from "@/shared/lib/utils"
import {
  centsToMajor,
  formatMoneyCents,
  majorToCents,
} from "@/shared/lib/format"
import { GET_SHOP_SHIPPING_SETTINGS } from "@/features/shipping/providers-api"
import type {
  ShopShippingSettings,
  ShopShippingSettingsResponse,
} from "@/features/shipping/providers-types"
import { VERIFY_DRAFT_SHIPPING } from "@/features/orders/api/draft-orders"
import { draftQuoteErrorKey } from "@/features/orders/lib/drafts/customer"
import type { DraftAddress } from "./draft-order-types"

export type DraftShippingProduct = {
  product_id: string
  quantity: number
  variation_option_id?: string | null
}

export type CheckoutShippingOption = {
  id: string
  name: unknown
  type: string
  fee_cents: number
  min_delivery_days?: number | null
  max_delivery_days?: number | null
  channel: string
  carrier_name?: string | null
  carrier_logo?: string | null
  package_count: number
}

type VerifyDraftShippingResult = {
  verifyCheckout?: {
    success: boolean
    data?: {
      shipping_available: boolean
      shipping_unavailable_reason?: string | null
      carrier_unavailable_reason?: string | null
      shipping_options: CheckoutShippingOption[]
    } | null
  } | null
}

type MethodKind = "merchant" | "carrier" | "custom"

interface ShippingOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  /** Null = zone pricing; 0 = free on purpose. */
  overrideCents: number | null
  name: string
  customerId?: string | null
  hasCustomerAddress: boolean
  /** Catalog lines only — custom items cannot be quoted. */
  products: DraftShippingProduct[]
  shippingAddress: DraftAddress | null
  onDone: (next: {
    overrideCents: number
    name: string
    /**
     * The picked option's id — a ShippingRule id or a
     * `carrier:<company>:<deliveryOptionId>` composite — or null for a
     * merchant-typed fee. The draft freezes it so conversion can create the
     * order WITH that method: an order carrying only a fee override is read
     * back as "no carrier chosen" and books through the shop's default.
     */
    methodId: string | null
  }) => void
  disabled?: boolean
}

function optionLabel(name: unknown, locale: string, fallback: string): string {
  if (typeof name === "string" && name.trim()) return name
  if (name && typeof name === "object") {
    const o = name as Record<string, string | null | undefined>
    const localized = o[locale] ?? o.en ?? o.ar
    if (localized?.trim()) return localized
  }
  return fallback
}

function carrierChannelTitle(
  settings: ShopShippingSettings | null | undefined,
  t: (key: string) => string,
): string {
  const slug = settings?.active_provider_slug?.trim().toLowerCase()
  if (slug === "oto") return t("carrierOto")
  if (slug) return slug.toUpperCase()
  return t("carrierChannel")
}

function defaultMethod(
  settings: ShopShippingSettings | null | undefined,
): MethodKind {
  if (!settings) return "merchant"
  if (settings.offers_merchant_delivery) return "merchant"
  if (settings.offers_carrier_delivery) return "carrier"
  return "custom"
}

/**
 * Shipping picker for a draft order.
 *
 * Lists the delivery channels the shop has enabled (own delivery / carrier
 * such as OTO), quotes live rates via `verifyCheckout` when products + address
 * are present, and always keeps a custom name+price escape hatch. Selection
 * persists as `shipping_override_cents` + display name — the draft API has no
 * method-id field today.
 */
export function ShippingOptionsDialog({
  open,
  onOpenChange,
  currency,
  overrideCents,
  name,
  customerId,
  hasCustomerAddress,
  products,
  shippingAddress,
  onDone,
  disabled,
}: ShippingOptionsDialogProps) {
  const t = useTranslations("draftOrders.form")
  const locale = useLocale()

  const { data: settingsData, loading: settingsLoading } =
    useQuery<ShopShippingSettingsResponse>(GET_SHOP_SHIPPING_SETTINGS, {
      skip: !open,
      fetchPolicy: "cache-first",
    })
  const settings = settingsData?.shopShippingSettings?.data ?? null
  const offersMerchant = settings?.offers_merchant_delivery ?? false
  const offersCarrier = settings?.offers_carrier_delivery ?? false
  const carrierReady = settings?.carrier_available ?? false

  const [verify, { data: quoteData, loading: quoting, error: quoteError }] =
    useMutation<VerifyDraftShippingResult>(VERIFY_DRAFT_SHIPPING)

  const quote = quoteData?.verifyCheckout?.data ?? null
  const options = quote?.shipping_options ?? []
  const merchantOptions = options.filter((o) => o.channel !== "carrier")
  const carrierOptions = options.filter((o) => o.channel === "carrier")

  const catalogProducts = useMemo(
    () => products.filter((p) => p.product_id),
    [products],
  )
  const productsKey = useMemo(
    () =>
      catalogProducts
        .map(
          (p) =>
            `${p.product_id}:${p.variation_option_id ?? ""}:${p.quantity}`,
        )
        .join("|"),
    [catalogProducts],
  )

  const canQuote =
    open &&
    hasCustomerAddress &&
    !!shippingAddress &&
    catalogProducts.length > 0

  // A refused quote (e.g. `invalid_customer` for a draft still holding a
  // legacy contact id) leaves no options, which used to read as "no rate
  // matches this address". Gated on `canQuote` so the error from an earlier
  // open does not outlive the address or products it was quoted for.
  const quoteRefusalKey =
    canQuote && !quoting ? draftQuoteErrorKey(quoteError) : null

  useEffect(() => {
    if (!canQuote || !shippingAddress) return
    // The refusal is read from the hook's `error`, which Apollo sets for the
    // latest call only; state set here could let an older failure overwrite
    // a newer success. The catch only keeps the rejection from going unhandled.
    verify({
      variables: {
        input: {
          customer_id: customerId || undefined,
          products: catalogProducts.map((p) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            ...(p.variation_option_id
              ? { variation_option_id: p.variation_option_id }
              : {}),
          })),
          shipping_address: {
            street_address: shippingAddress.street_address,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.zip,
            country: shippingAddress.country,
          },
        },
      },
    }).catch(() => {})
  }, [canQuote, verify, shippingAddress, productsKey, catalogProducts, customerId])

  const [method, setMethod] = useState<MethodKind>(() =>
    defaultMethod(settings),
  )
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState(name || t("freeShippingDefault"))
  const [priceMajor, setPriceMajor] = useState(
    overrideCents === null ? "0.00" : String(centsToMajor(overrideCents)),
  )
  const [wasOpen, setWasOpen] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMethod(defaultMethod(settings))
      setSelectedOptionId(null)
      setNameDraft(name || t("freeShippingDefault"))
      setPriceMajor(
        overrideCents === null ? "0.00" : String(centsToMajor(overrideCents)),
      )
    }
  }

  // Settings often arrive after open; snap off a channel that is not offered.
  const settingsKey = settings
    ? `${settings.offers_merchant_delivery}:${settings.offers_carrier_delivery}:${settings.active_provider_slug ?? ""}`
    : ""
  const [methodSeededKey, setMethodSeededKey] = useState("")
  if (open && settingsKey && methodSeededKey !== settingsKey) {
    setMethodSeededKey(settingsKey)
    const stillValid =
      (method === "merchant" && offersMerchant) ||
      (method === "carrier" && offersCarrier) ||
      method === "custom"
    if (!stillValid) setMethod(defaultMethod(settings))
  }

  const carrierTitle = carrierChannelTitle(settings, t)
  const priceCents = majorToCents(Number(priceMajor) || 0)
  const nameTrimmed = nameDraft.trim()

  const selectedOption =
    selectedOptionId != null
      ? (options.find((o) => o.id === selectedOptionId) ?? null)
      : null

  const usingCustomFields =
    method === "custom" ||
    (method === "merchant" && merchantOptions.length === 0 && !quoting) ||
    (method === "carrier" && carrierOptions.length === 0 && !quoting)

  const canDone = selectedOption
    ? true
    : usingCustomFields
      ? nameTrimmed.length > 0
      : false

  const handleDone = () => {
    if (selectedOption) {
      onDone({
        overrideCents: selectedOption.fee_cents,
        name:
          selectedOption.carrier_name?.trim() ||
          optionLabel(selectedOption.name, locale, t("shipping")),
        methodId: selectedOption.id,
      })
      onOpenChange(false)
      return
    }
    if (!usingCustomFields || !nameTrimmed) return
    onDone({ overrideCents: priceCents, name: nameTrimmed, methodId: null })
    onOpenChange(false)
  }

  const pickMethod = (v: string | null) => {
    if (v !== "merchant" && v !== "carrier" && v !== "custom") return
    setMethod(v)
    setSelectedOptionId(null)
    if (v === "merchant") setNameDraft(t("merchantChannel"))
    else if (v === "carrier") setNameDraft(carrierTitle)
    else if (!nameDraft.trim()) setNameDraft(t("freeShippingDefault"))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("shippingModalTitle")}</DialogTitle>
        </DialogHeader>

        {!hasCustomerAddress ? (
          <div
            role="status"
            className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("shippingNeedAddress")}</p>
          </div>
        ) : catalogProducts.length === 0 ? (
          <div
            role="status"
            className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("shippingNeedProducts")}</p>
          </div>
        ) : quoteRefusalKey ? (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t(quoteRefusalKey)}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t("shippingMethodHeading")}</p>

          {settingsLoading && !settings ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {t("shippingLoadingMethods")}
            </div>
          ) : (
            <RadioGroup
              value={method}
              onValueChange={pickMethod}
              disabled={disabled}
              className="gap-2"
            >
              {offersMerchant || !settings ? (
                <MethodRow
                  value="merchant"
                  label={t("merchantChannel")}
                  hint={t("merchantChannelHint")}
                  selected={method === "merchant"}
                >
                  {method === "merchant" ? (
                    <ChannelRates
                      loading={quoting && canQuote}
                      options={merchantOptions}
                      selectedId={selectedOptionId}
                      onSelect={setSelectedOptionId}
                      currency={currency}
                      locale={locale}
                      fallbackName={t("shipping")}
                      emptyHint={
                        canQuote && !quoteRefusalKey
                          ? t("shippingNoMerchantRates")
                          : t("shippingEnterCustom")
                      }
                      showCustom={usingCustomFields && method === "merchant"}
                      nameDraft={nameDraft}
                      setNameDraft={setNameDraft}
                      priceMajor={priceMajor}
                      setPriceMajor={setPriceMajor}
                      currencyCode={currency}
                      disabled={disabled}
                      t={t}
                    />
                  ) : null}
                </MethodRow>
              ) : null}

              {offersCarrier ? (
                <MethodRow
                  value="carrier"
                  label={carrierTitle}
                  hint={
                    carrierReady
                      ? t("carrierChannelHint")
                      : t("carrierNotReady")
                  }
                  selected={method === "carrier"}
                >
                  {method === "carrier" ? (
                    <ChannelRates
                      loading={quoting && canQuote}
                      options={carrierOptions}
                      selectedId={selectedOptionId}
                      onSelect={setSelectedOptionId}
                      currency={currency}
                      locale={locale}
                      fallbackName={carrierTitle}
                      emptyHint={
                        !carrierReady
                          ? t("carrierNotReady")
                          : quoteRefusalKey
                            ? t("shippingEnterCustom")
                            : quote?.carrier_unavailable_reason
                              ? t("carrierUnavailable")
                              : canQuote
                                ? t("shippingNoCarrierRates")
                                : t("shippingEnterCustom")
                      }
                      showCustom={
                        usingCustomFields && method === "carrier" && carrierReady
                      }
                      nameDraft={nameDraft}
                      setNameDraft={setNameDraft}
                      priceMajor={priceMajor}
                      setPriceMajor={setPriceMajor}
                      currencyCode={currency}
                      disabled={disabled || !carrierReady}
                      t={t}
                    />
                  ) : null}
                </MethodRow>
              ) : null}

              <MethodRow
                value="custom"
                label={t("customShipping")}
                hint={t("customShippingHint")}
                selected={method === "custom"}
              >
                {method === "custom" ? (
                  <CustomFields
                    nameDraft={nameDraft}
                    setNameDraft={setNameDraft}
                    priceMajor={priceMajor}
                    setPriceMajor={setPriceMajor}
                    currencyCode={currency}
                    disabled={disabled}
                    t={t}
                  />
                ) : null}
              </MethodRow>
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={disabled || !canDone || (settingsLoading && !settings)}
            onClick={handleDone}
          >
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MethodRow({
  value,
  label,
  hint,
  selected,
  children,
}: {
  value: MethodKind
  label: string
  hint?: string
  selected: boolean
  children?: React.ReactNode
}) {
  const id = `draft-ship-${value}`
  return (
    <div
      className={cn(
        "rounded-lg border border-border px-3 py-2.5",
        selected && "border-primary/40 bg-muted/30",
      )}
    >
      <div className="flex items-start gap-2.5">
        <RadioGroupItem id={id} value={value} className="mt-0.5" />
        <Label
          htmlFor={id}
          className="flex-1 cursor-pointer text-sm font-medium leading-snug"
        >
          {label}
          {hint ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </Label>
      </div>
      {selected && children ? (
        <div className="mt-3 ms-6 flex flex-col gap-2">{children}</div>
      ) : null}
    </div>
  )
}

function ChannelRates({
  loading,
  options,
  selectedId,
  onSelect,
  currency,
  locale,
  fallbackName,
  emptyHint,
  showCustom,
  nameDraft,
  setNameDraft,
  priceMajor,
  setPriceMajor,
  currencyCode,
  disabled,
  t,
}: {
  loading: boolean
  options: CheckoutShippingOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  currency: string
  locale: string
  fallbackName: string
  emptyHint: string
  showCustom: boolean
  nameDraft: string
  setNameDraft: (v: string) => void
  priceMajor: string
  setPriceMajor: (v: string) => void
  currencyCode: string
  disabled?: boolean
  t: ReturnType<typeof useTranslations>
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        {t("shippingRatesLoading")}
      </div>
    )
  }

  if (options.length > 0) {
    return (
      <div className="flex flex-col gap-1.5" role="listbox">
        {options.map((opt) => {
          const selected = opt.id === selectedId
          const label =
            opt.carrier_name?.trim() ||
            optionLabel(opt.name, locale, fallbackName)
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-start text-sm transition-colors",
                selected
                  ? "border-primary bg-background"
                  : "border-border bg-background hover:bg-muted/40",
                disabled && "opacity-50",
              )}
            >
              <span className="min-w-0 truncate font-medium">{label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoneyCents(opt.fee_cents, currency)}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (showCustom) {
    return (
      <>
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
        <CustomFields
          nameDraft={nameDraft}
          setNameDraft={setNameDraft}
          priceMajor={priceMajor}
          setPriceMajor={setPriceMajor}
          currencyCode={currencyCode}
          disabled={disabled}
          t={t}
        />
      </>
    )
  }

  return <p className="text-xs text-muted-foreground">{emptyHint}</p>
}

function CustomFields({
  nameDraft,
  setNameDraft,
  priceMajor,
  setPriceMajor,
  currencyCode,
  disabled,
  t,
}: {
  nameDraft: string
  setNameDraft: (v: string) => void
  priceMajor: string
  setPriceMajor: (v: string) => void
  currencyCode: string
  disabled?: boolean
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ship-name">{t("shippingName")}</Label>
        <Input
          id="ship-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ship-price">{t("shippingPrice")}</Label>
        <div className="relative">
          <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {currencyCode}
          </span>
          <Input
            id="ship-price"
            type="number"
            min={0}
            step="0.01"
            value={priceMajor}
            onChange={(e) => setPriceMajor(e.target.value)}
            disabled={disabled}
            className="ps-12 tabular-nums"
          />
        </div>
      </div>
    </div>
  )
}
