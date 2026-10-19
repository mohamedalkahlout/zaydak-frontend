"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { useCurrency } from "@/shared/lib/currency/use-currency"
import { validationMessage } from "@/shared/lib/validation-errors"
import { useCurrentUser } from "@/features/auth/use-current-user"
import { EMPTY_ADDRESS, isAddressComplete, type Address } from "@/features/addresses/lib/address"
import { validateContact } from "@/shared/lib/contact-validation"
import { useAddresses } from "@/features/addresses/use-addresses"
import { useCart } from "@/features/cart/use-cart"
import { useShop } from "@/features/shop/shop-context"
import { usePaymentOptions, type PaymentMethod } from "@/features/bank-transfers/use-payment-options"
import { BANKS, SHOP_BANK_ACCOUNTS } from "@/features/bank-transfers/api"
import { CREATE_ORDER, CREATE_PAYMENT_LINK, VERIFY_CHECKOUT } from "./api"
import { blockedLineNames, quoteBlockedProductIds } from "./lib/blocked-lines"
import { needsRequote } from "./lib/requote"
import { cartNeedsShipping } from "./lib/shipping"
import type { CheckoutQuote, CheckoutStep } from "./components/order-summary"

/** Long enough to cover typing a street name, short enough to feel immediate. */
const VERIFY_DEBOUNCE_MS = 500

const EMPTY_SHIPPING_OPTIONS: NonNullable<CheckoutQuote>["shipping_options"] = []

function areShippingOptionsEqual(
  a: NonNullable<CheckoutQuote>["shipping_options"],
  b: NonNullable<CheckoutQuote>["shipping_options"],
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const optA = a[i]
    const optB = b[i]
    if (!optA || !optB) return false
    if (
      optA.id !== optB.id ||
      optA.fee_cents !== optB.fee_cents ||
      optA.name !== optB.name ||
      optA.min_delivery_days !== optB.min_delivery_days ||
      optA.max_delivery_days !== optB.max_delivery_days ||
      optA.carrier_logo !== optB.carrier_logo ||
      optA.package_count !== optB.package_count ||
      optA.channel !== optB.channel
    ) {
      return false
    }
  }
  return true
}

function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Contact, address, quote and place-order for every checkout skin.
 * Money still comes from `verifyCheckout`. The screen only renders it.
 */
export function useCheckout() {
  const t = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const { slug, base, shop, currency } = useShop()
  const { cart, items, summary, loading: cartLoading } = useCart()

  const { user: me, isAuthenticated } = useCurrentUser()

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const [note, setNote] = useState("")
  const [paymentChoice, setPayment] = useState<PaymentMethod | null>(null)
  const [bankAccountId, setBankAccountId] = useState("")
  const paymentOptions = usePaymentOptions()
  const payment = paymentChoice && paymentOptions.methods.includes(paymentChoice)
    ? paymentChoice : paymentOptions.methods[0] ?? null
  const bankAccounts = useQuery(SHOP_BANK_ACCOUNTS, {
    skip: payment !== "BANK_TRANSFER" || !isAuthenticated,
    fetchPolicy: "no-cache",
  })
  const banks = useQuery(BANKS, { variables: { locale }, skip: payment !== "BANK_TRANSFER" })
  const accounts = bankAccounts.data?.shopBankAccounts.data ?? []
  const selectedBankAccount = accounts.find((account) => account.id === bankAccountId) ?? accounts[0]
  const [placing, setPlacing] = useState(false)
  const [shippingRuleId, setShippingRuleId] = useState<string | null>(null)
  // Bumped when `createOrder` refuses because the price moved since the quote
  // on screen: the verify effect runs again and shows the real total.
  const [requoteCount, setRequoteCount] = useState(0)

  const { preferred } = useAddresses()
  const [seededAddress, setSeededAddress] = useState(false)
  if (!seededAddress && preferred) {
    setSeededAddress(true)
    setAddress(preferred.address)
  }

  const [contact, setContact] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [contactTouched, setContactTouched] = useState(false)
  const [seededContact, setSeededContact] = useState(false)
  if (!seededContact && me) {
    setSeededContact(true)
    // The number first: it is the customer's identity, and the one a courier
    // calls.
    setContact(me.phone_e164 ?? me.email ?? "")
    setCustomerName(me.name ?? "")
  }

  const contactValidation = useMemo(() => validateContact(contact), [contact])
  const contactReady = isAuthenticated
    ? !contact.trim() || contactValidation.valid
    : contactValidation.valid

  const { isConverted, formatDisplayPrice } = useCurrency()

  const contactError = useMemo(() => {
    if (!contactTouched && !contact) return null
    if (!contact.trim()) {
      return !isAuthenticated ? t("contactRequired") : null
    }
    if (!contactValidation.valid) {
      return t("contactInvalid")
    }
    return null
  }, [contact, contactTouched, contactValidation.valid, isAuthenticated, t])

  const handleContactBlur = useCallback(() => {
    setContactTouched(true)
    if (contact.trim()) {
      const res = validateContact(contact)
      if (res.valid) {
        setContact(res.normalized)
      }
    }
  }, [contact])

  const orderable = useMemo(
    () => items.filter((item) => item.status === "AVAILABLE"),
    [items],
  )
  const blockedCount = items.length - orderable.length

  const needsShipping = useMemo(() => cartNeedsShipping(orderable), [orderable])

  const coupons = useMemo(() => summary?.coupons ?? [], [summary])
  const couponCodes = useMemo(
    () =>
      coupons
        .map((coupon) => coupon.code)
        .filter((code): code is string => Boolean(code)),
    [coupons],
  )

  const [verifyCheckout, { data: verifyData, loading: verifying }] =
    useMutation(VERIFY_CHECKOUT)
  const [createOrder] = useMutation(CREATE_ORDER)
  const [createPaymentLink] = useMutation(CREATE_PAYMENT_LINK)

  const quote = verifyData?.verifyCheckout.data ?? null

  const rawQuoteBlockedIds = useMemo(
    () => quoteBlockedProductIds(quote?.unavailable_products),
    [quote?.unavailable_products],
  )
  // Kept in state and adjusted during render so the identity changes only when
  // the contents do. Every re-quote builds a fresh Set, and handing a new one
  // downstream on each poll would re-create `onPlaceOrder` and re-render the
  // memo'd summary even though nothing about the order changed.
  const [quoteBlockedIds, setQuoteBlockedIds] = useState(rawQuoteBlockedIds)
  if (!areSetsEqual(quoteBlockedIds, rawQuoteBlockedIds)) {
    setQuoteBlockedIds(rawQuoteBlockedIds)
  }

  const rawBlockedNames = useMemo(
    () => blockedLineNames(items, quoteBlockedIds),
    [items, quoteBlockedIds],
  )
  // Same reason as above: this array is a prop of the memo'd summary.
  const [blockedNames, setBlockedNames] = useState(rawBlockedNames)
  if (!areStringArraysEqual(blockedNames, rawBlockedNames)) {
    setBlockedNames(rawBlockedNames)
  }

  const addressReady = !needsShipping || isAddressComplete(address)

  const rawShippingOptions = quote?.shipping_options ?? EMPTY_SHIPPING_OPTIONS
  // Same reason as above: this array is a prop of the memo'd summary.
  const [shippingOptions, setShippingOptions] = useState(rawShippingOptions)
  if (!areShippingOptionsEqual(shippingOptions, rawShippingOptions)) {
    setShippingOptions(rawShippingOptions)
  }

  // Tested against the raw list rather than the stabilised one: on the render
  // that adopts a new quote the stabilised copy is still the previous list, and
  // clearing a rule the new quote does still offer would re-price the order.
  // Deeply equal lists carry the same ids, so this is otherwise the same test.
  if (
    shippingRuleId &&
    quote &&
    !rawShippingOptions.some((option) => option.id === shippingRuleId)
  ) {
    setShippingRuleId(null)
  }

  const selectedOptionId =
    shippingRuleId ?? quote?.selected_shipping_rule_id ?? null

  const prevAddressRef = useRef<Address>(address)
  const inFlightVerifyRef = useRef<Promise<unknown> | null>(null)

  useEffect(() => {
    if (orderable.length === 0 || !addressReady || !payment) return

    const isAddressChange = prevAddressRef.current !== address
    prevAddressRef.current = address
    const delay = isAddressChange ? VERIFY_DEBOUNCE_MS : 0

    const timer = setTimeout(() => {
      const p = verifyCheckout({
        variables: {
          input: {
            products: orderable.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              ...(item.variation_option_id
                ? { variation_option_id: item.variation_option_id }
                : {}),
              ...(item.composition ? { composition: item.composition } : {}),
            })),
            ...(needsShipping
              ? { shipping_address: address, billing_address: address }
              : {}),
            ...(needsShipping && shippingRuleId
              ? { shipping_rule_id: shippingRuleId }
              : {}),
            ...(cart?.id ? { cart_id: cart.id } : {}),
            ...(couponCodes.length > 0
              ? {
                  coupon_codes: couponCodes,
                  coupon_code: couponCodes[0],
                }
              : {}),
            payment_gateway: payment,
          },
        },
      })
      inFlightVerifyRef.current = p
      p.catch(() => {
        sileo.error({ title: t("verifyError") })
      }).finally(() => {
        if (inFlightVerifyRef.current === p) {
          inFlightVerifyRef.current = null
        }
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [
    orderable,
    address,
    addressReady,
    needsShipping,
    payment,
    couponCodes,
    shippingRuleId,
    cart?.id,
    verifyCheckout,
    t,
    requoteCount,
  ])

  // Read here rather than inside the callback: an optional-chained property
  // read in the closure body makes the compiler infer the whole `quote` /
  // `cart` object as the dependency, which is coarser than the hand-written
  // list and drops the memoization. The values, and so the callback's
  // identity, change exactly when they did before.
  const quoteShippingRuleId = quote?.selected_shipping_rule_id
  const cartId = cart?.id
  // The total beside the button when it is pressed — the most the order may
  // cost. `createOrder` refuses a higher one instead of charging it.
  const shownTotalCents = quote?.total_cents ?? summary?.total_price_cents ?? 0

  const onPlaceOrder = useCallback(async () => {
    setContactTouched(true)
    if (!contactReady) {
      sileo.error({
        title: !contact.trim() ? t("contactRequired") : t("contactInvalid"),
      })
      return
    }
    if (
      !addressReady ||
      orderable.length === 0 ||
      !payment ||
      paymentOptions.error ||
      (payment === "BANK_TRANSFER" && !selectedBankAccount)
    )
      return
    if (quoteBlockedIds.size > 0) return
    setPlacing(true)
    try {
      if (inFlightVerifyRef.current) {
        try {
          await inFlightVerifyRef.current
        } catch {
          // Handled in verify error listener
        }
      }
      const normalizedContact = contactValidation.valid
        ? contactValidation.normalized
        : contact.trim() || undefined
      const effectiveAddress = needsShipping
        ? {
            ...address,
            phone:
              address.phone?.trim() ||
              (contactValidation.valid && contactValidation.type === "phone"
                ? contactValidation.normalized
                : ""),
          }
        : address
      const result = await createOrder({
        variables: {
          input: {
            products: orderable.map((item) => ({
              product_id: item.product_id,
              order_quantity: item.quantity,
              ...(item.variation_option_id
                ? { variation_option_id: item.variation_option_id }
                : {}),
              ...(item.composition ? { composition: item.composition } : {}),
            })),
            ...(needsShipping
              ? {
                  shipping_address: effectiveAddress,
                  billing_address: effectiveAddress,
                }
              : {}),
            ...(needsShipping && quoteShippingRuleId
              ? { shipping_rule_id: quoteShippingRuleId }
              : {}),
            ...(coupons.length > 0
              ? { coupons: coupons.map((coupon) => coupon.id) }
              : {}),
            payment_gateway: payment,
            ...(payment === "BANK_TRANSFER" && selectedBankAccount
              ? { bank_account_id: selectedBankAccount.id }
              : {}),
            customer_name: customerName || undefined,
            customer_contact: normalizedContact,
            language: locale,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(cartId ? { cart_id: cartId } : {}),
            expected_total_cents: shownTotalCents,
          },
        },
      })

      const order = result.data?.createOrder.data
      if (!order) {
        sileo.error({ title: tCommon("somethingWentWrong") })
        return
      }

      if (payment === "STRIPE") {
        const link = await createPaymentLink({
          variables: { order_id: order.id, payment_gateway: "STRIPE" },
        })
        const url = link.data?.createPaymentLink.payment_url
        if (url) {
          window.location.href = url
          return
        }
        sileo.error({ title: tCommon("somethingWentWrong") })
      }

      router.replace(`${base}/account/orders/${order.id}?placed=1`)
    } catch (error) {
      if (needsRequote(error)) {
        // Nothing was ordered: the price moved since this quote. Price it
        // again so the new total is on screen before the next press.
        sileo.error({ title: t("priceChanged") })
        setRequoteCount((count) => count + 1)
        return
      }
      sileo.error({
        title: validationMessage(error, tCommon("somethingWentWrong")),
      })
    } finally {
      setPlacing(false)
    }
  }, [
    contactReady,
    addressReady,
    orderable,
    payment,
    paymentOptions.error,
    selectedBankAccount,
    quoteBlockedIds,
    contactValidation,
    contact,
    needsShipping,
    address,
    createOrder,
    quoteShippingRuleId,
    coupons,
    customerName,
    locale,
    note,
    cartId,
    shownTotalCents,
    tCommon,
    createPaymentLink,
    router,
    base,
    t,
  ])

  const onPlaceOrderRef = useRef(onPlaceOrder)
  useEffect(() => {
    onPlaceOrderRef.current = onPlaceOrder
  }, [onPlaceOrder])
  const handlePlaceOrder = useCallback(() => {
    void onPlaceOrderRef.current()
  }, [])

  const activeCurrency = summary?.currency ?? currency

  const shippingUnpriced =
    needsShipping && quote !== null && !quote.shipping_available
  const destinationExcluded =
    shippingUnpriced &&
    quote?.shipping_unavailable_reason === "destination_excluded"

  const totalCents = shownTotalCents
  const canPlace =
    !placing &&
    Boolean(payment) &&
    !paymentOptions.loading &&
    !paymentOptions.error &&
    (payment !== "BANK_TRANSFER" ||
      (Boolean(selectedBankAccount) &&
        !bankAccounts.loading &&
        !bankAccounts.error)) &&
    addressReady &&
    contactReady &&
    orderable.length > 0 &&
    quoteBlockedIds.size === 0 &&
    !destinationExcluded

  const steps: CheckoutStep[] = useMemo(
    () => [
      { key: "delivery", done: addressReady },
      { key: "payment", done: addressReady && Boolean(payment) },
      { key: "review", done: addressReady && quote !== null },
    ],
    [addressReady, payment, quote],
  )
  const currentStep = steps.findIndex((step) => !step.done)

  const actionLabel =
    payment === "STRIPE" ? t("continueToPayment") : t("placeOrder")

  const handleCustomerNameChange = useCallback((val: string) => {
    setCustomerName(val)
  }, [])

  const handleContactChange = useCallback((val: string) => {
    setContact(val)
  }, [])

  const handleAddressChange = useCallback((addr: Address) => {
    setAddress(addr)
  }, [])

  const handlePaymentChange = useCallback((method: PaymentMethod) => {
    setPayment(method)
  }, [])

  const handleShippingRuleSelect = useCallback((id: string) => {
    setShippingRuleId(id)
  }, [])

  const handleBankAccountIdChange = useCallback((id: string) => {
    setBankAccountId(id)
  }, [])

  const handleRefetchPaymentOptions = useCallback(() => {
    void paymentOptions.refetch()
  }, [paymentOptions])

  const handleRefetchBankAccounts = useCallback(() => {
    void bankAccounts.refetch()
  }, [bankAccounts])

  const handleNoteChange = useCallback((next: string) => {
    setNote(next)
  }, [])

  const shopName = shop?.name ?? slug
  const logo = shop?.logo?.thumbnail ?? shop?.logo?.original ?? null

  const bankNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const b of banks.data?.banks.data ?? []) {
      map[b.code] = b.name
    }
    return map
  }, [banks.data?.banks.data])


  if (cartLoading && items.length === 0) {
    return { status: "loading" as const, base, shopName }
  }
  if (items.length === 0) {
    return { status: "empty" as const, base, shopName }
  }
  return {
    status: "ready" as const,
    base,
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
  }
}

export type CheckoutSession = ReturnType<typeof useCheckout>
export type CheckoutReady = Extract<CheckoutSession, { status: "ready" }>
