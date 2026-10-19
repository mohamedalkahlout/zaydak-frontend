"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { sileo } from "sileo"
import {
  ChevronLeftIcon,
  FilePlus2Icon,
  GlobeIcon,
  ImageIcon,
  NetworkIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import {
  CREATE_DRAFT_ORDER,
  UPDATE_DRAFT_ORDER,
  CONVERT_DRAFT_ORDER,
  DELETE_DRAFT_ORDER,
  GET_DRAFT_ORDERS,
} from "@/features/orders/api"
import type {
  DraftOrder,
  DraftPaymentTerm,
  CreateDraftOrderResponse,
  ConvertDraftOrderResponse,
} from "@/features/orders/types"
import {
  draftConvertGateway,
  readDraftPaymentTerm,
} from "@/features/orders/lib/drafts/payment"
import {
  draftCouponErrorKey,
  draftCouponLabel,
  draftCouponsFromDraft,
  sumCouponEstimates,
  type DraftCouponPick,
} from "@/features/orders/lib/drafts/coupons"
import { draftCustomerErrorKey } from "@/features/orders/lib/drafts/customer"
import { GET_MY_SHOPS } from "@/features/shops/api"
import { geoLabel, resolveCountry } from "@/shared/geo"
import {
  translatable,
  formatMoneyCents,
} from "@/shared/lib/format"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { Button } from "@repo/ui/components/button"
import { Card } from "@repo/ui/components/card"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { AddNoteDialog } from "./add-note-dialog"
import { AddDiscountDialog } from "./add-discount-dialog"
import { ShippingOptionsDialog } from "./shipping-options-dialog"
import { CustomItemDialog, type CustomLineDraft } from "./custom-item-dialog"
import { NewCustomerDialog } from "./new-customer-dialog"
import { DraftProductPicker, type PickedProduct } from "./draft-product-picker"
import { SendInvoiceDialog } from "./send-invoice-dialog"
import {
  CustomerPickerDialog,
  type PickedCustomer,
} from "./customer-picker-dialog"
import {
  addressIsEmpty,
  currencyDisplayLabel,
  EMPTY_DRAFT_ADDRESS,
  readDraftAddress,
  type DraftAddress,
  type LineDraft,
} from "./draft-order-types"

type Baseline = {
  lines: LineDraft[]
  customerId: string | null
  customerName: string
  customerContact: string
  note: string
  discountCents: number
  discountReason: string
  shippingOverrideCents: number | null
  shippingName: string
  shippingMethodId: string | null
  address: DraftAddress
  tags: string[]
  paymentDueLater: boolean
  paymentTerms: DraftPaymentTerm
  /** Store coupons, saved by id; the server prices them at conversion. */
  coupons: DraftCouponPick[]
}

function draftToBaseline(draft?: DraftOrder): Baseline {
  return {
    lines: (draft?.line_items ?? []).map((li) => ({
      product_id: li.product_id,
      variation_option_id: li.variation_option_id ?? null,
      name:
        translatable(li.product_name ?? "") ||
        li.slug ||
        li.product_id.slice(0, 6),
      image: li.image?.thumbnail ?? li.image?.original ?? null,
      unit_price_cents: li.unit_price_cents,
      quantity: li.quantity,
    })),
    customerId: draft?.customer_id ?? null,
    customerName: draft?.customer_name ?? "",
    customerContact: draft?.customer_contact ?? "",
    note: draft?.note ?? "",
    discountCents: draft?.manual_discount_cents ?? 0,
    discountReason: "",
    shippingOverrideCents: draft?.shipping_override_cents ?? null,
    shippingName: draft?.shipping_method_name ?? "",
    shippingMethodId: draft?.shipping_rule_id ?? null,
    address: readDraftAddress(draft?.shipping_address),
    tags: draft?.tags ?? [],
    // Seeded from the draft: these were hardcoded, so a reopened draft always
    // forgot that it was due later and on which terms.
    paymentDueLater: draft?.payment_due_later ?? false,
    paymentTerms: readDraftPaymentTerm(draft?.payment_terms),
    coupons: draftCouponsFromDraft(draft),
  }
}

const normalize = (b: Baseline) =>
  JSON.stringify({
    lines: b.lines.map((l) => [
      l.product_id,
      l.variation_option_id,
      l.quantity,
      l.unit_price_cents,
      l.name,
      !!l.is_custom,
    ]),
    customerId: b.customerId,
    customerName: b.customerName.trim(),
    customerContact: b.customerContact.trim(),
    note: b.note.trim(),
    discountCents: b.discountCents,
    discountReason: b.discountReason.trim(),
    shippingOverrideCents: b.shippingOverrideCents,
    shippingName: b.shippingName.trim(),
    shippingMethodId: b.shippingMethodId,
    address: Object.fromEntries(
      Object.entries(b.address).map(([k, v]) => [k, v.trim()]),
    ),
    tags: b.tags,
    paymentDueLater: b.paymentDueLater,
    paymentTerms: b.paymentTerms,
    // Only the ids are saved: a preview figure arriving is not a change.
    couponIds: b.coupons.map((c) => c.id),
  })

interface MyShopsTaxResult {
  myShops?: {
    data?: Array<{
      slug: string
      name?: string | null
      tax_bps?: number | null
      settings?: { location?: { country?: string | null } | null } | null
      address?: { country?: string | null } | null
    } | null> | null
  } | null
}

/**
 * Shopify-parity create/edit draft order. Left = Products + Payment; right =
 * Notes, Customer, Markets (currency), Tags. Stages locally; persists through
 * the global save bar. An open saved draft converts into a real Order.
 */
export function DraftOrderForm({
  mode,
  draft,
}: {
  mode: "create" | "edit"
  draft?: DraftOrder
}) {
  const t = useTranslations("draftOrders.form")
  const locale = useLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const router = useRouter()
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)
  const storeSlug = useActiveShopStore((s) => s.slug)
  const shopCurrency = useShopCurrency()
  const currency = draft?.currency ?? shopCurrency

  const { data: shopsData } = useQuery<MyShopsTaxResult>(GET_MY_SHOPS, {
    fetchPolicy: "cache-first",
    skip: !(shopSlug || storeSlug),
  })
  const shopRow = shopsData?.myShops?.data?.find(
    (s) => s?.slug === (shopSlug || storeSlug),
  )
  const taxBps = shopRow?.tax_bps ?? 0
  // The back-end stores the shop's country as an ISO code, so it is named here
  // the way Settings > General names it; a value the table cannot place (an
  // older row's free text) is shown as it was written.
  const marketCountry =
    shopRow?.settings?.location?.country || shopRow?.address?.country
  const marketCountryEntry = resolveCountry(marketCountry)
  const marketLabel =
    (marketCountryEntry
      ? geoLabel(marketCountryEntry, locale)
      : marketCountry) ||
    shopRow?.name ||
    t("defaultMarket")

  const ordersBase = shopSlug ? `/store/${shopSlug}/orders` : "/store"
  const draftsBase = `${ordersBase}/drafts`

  const initial = useMemo(() => draftToBaseline(draft), [draft])

  const [baseline, setBaseline] = useState<Baseline>(initial)
  const [lines, setLines] = useState<LineDraft[]>(initial.lines)
  const [customerId, setCustomerId] = useState<string | null>(initial.customerId)
  const [customerName, setCustomerName] = useState(initial.customerName)
  const [customerContact, setCustomerContact] = useState(
    initial.customerContact,
  )
  const [note, setNote] = useState(initial.note)
  const [discountCents, setDiscountCents] = useState(initial.discountCents)
  const [discountReason, setDiscountReason] = useState(initial.discountReason)
  const [shippingOverrideCents, setShippingOverrideCents] = useState<
    number | null
  >(initial.shippingOverrideCents)
  const [shippingName, setShippingName] = useState(initial.shippingName)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    initial.shippingMethodId,
  )
  const [address, setAddress] = useState<DraftAddress>(initial.address)
  const [tags, setTags] = useState<string[]>(initial.tags)
  const [tagInput, setTagInput] = useState("")
  const [paymentDueLater, setPaymentDueLater] = useState(
    initial.paymentDueLater,
  )
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms)
  const [coupons, setCoupons] = useState<DraftCouponPick[]>(initial.coupons)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false)

  const staged: Baseline = {
    lines,
    customerId,
    customerName,
    customerContact,
    note,
    discountCents,
    discountReason,
    shippingOverrideCents,
    shippingName,
    shippingMethodId,
    address,
    tags,
    paymentDueLater,
    paymentTerms,
    coupons,
  }
  const dirty = normalize(staged) !== normalize(baseline)

  const catalogLines = lines.filter((l) => !l.is_custom)
  const hasCustom = lines.some((l) => l.is_custom)

  const subtotalCents = useMemo(
    () => lines.reduce((sum, l) => sum + l.unit_price_cents * l.quantity, 0),
    [lines],
  )
  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  )
  const appliedDiscount = Math.min(discountCents, subtotalCents)
  // Store coupons are priced by the server at conversion, for the draft's
  // customer. What is shown here is the preview's estimate, labelled so.
  const couponEstimate = sumCouponEstimates(coupons)
  const couponEstimateCents = Math.min(
    couponEstimate.cents,
    Math.max(0, subtotalCents - appliedDiscount),
  )
  const couponWarning = coupons.some((c) => !c.available)
    ? t("couponUnavailable")
    : !customerId && coupons.some((c) => c.requiresCustomer)
      ? t("couponNeedsCustomer")
      : null
  const shippingCents = shippingOverrideCents ?? 0
  const taxableBase = Math.max(
    0,
    subtotalCents - appliedDiscount - couponEstimateCents + shippingCents,
  )
  const estimatedTaxCents =
    taxBps > 0 ? Math.round((taxableBase * taxBps) / 10_000) : 0
  const totalCents = taxableBase + estimatedTaxCents

  const existingIds = useMemo(
    () => new Set(catalogLines.map((l) => l.product_id)),
    [catalogLines],
  )

  function addProducts(picked: PickedProduct[]) {
    setLines((prev) => {
      const have = new Set(prev.map((l) => l.product_id))
      const next = [...prev]
      for (const p of picked) {
        if (have.has(p.product_id)) continue
        have.add(p.product_id)
        next.push({
          product_id: p.product_id,
          variation_option_id: null,
          name: p.name,
          image: p.image ?? null,
          unit_price_cents: p.unit_price_cents,
          quantity: 1,
        })
      }
      return next
    })
  }

  function addCustom(line: CustomLineDraft) {
    setLines((prev) => [...prev, line])
  }

  const setQty = (id: string, n: number) =>
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === id ? { ...l, quantity: Math.max(1, n) } : l,
      ),
    )
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.product_id !== id))

  function applyCustomer(c: PickedCustomer) {
    setCustomerId(c.customer_id)
    setCustomerName(c.customer_name)
    setCustomerContact(c.customer_contact ?? "")
    if (c.address && !addressIsEmpty(c.address)) {
      setAddress(c.address)
    }
  }
  function clearCustomer() {
    setCustomerId(null)
    setCustomerName("")
    setCustomerContact("")
  }

  function addTagFromInput() {
    const next = tagInput.trim()
    if (!next || tags.includes(next)) {
      setTagInput("")
      return
    }
    setTags((prev) => [...prev, next])
    setTagInput("")
  }

  /**
   * A coupon or customer refusal in words the merchant can act on, else
   * `fallback`.
   */
  const describeError = (err: unknown, fallback: string) => {
    const key = draftCouponErrorKey(err) ?? draftCustomerErrorKey(err)
    return key ? t(key) : fallback
  }

  const [create, createState] = useMutation<CreateDraftOrderResponse>(
    CREATE_DRAFT_ORDER,
    {
      refetchQueries: [
        { query: GET_DRAFT_ORDERS, variables: { page: 1, limit: 50 } },
      ],
      onError: (err) => {
        const msg = describeError(err, err.message)
        sileo.error({ title: msg })
        setBarError(msg)
      },
    },
  )
  const [update, updateState] = useMutation(UPDATE_DRAFT_ORDER, {
    onCompleted: () => {
      sileo.success({ title: t("toastSaved") })
      setBaseline(staged)
    },
    onError: (err) => {
      const msg = describeError(err, err.message)
      sileo.error({ title: msg })
      setBarError(msg)
    },
  })
  const [convert, convertState] = useMutation<ConvertDraftOrderResponse>(
    CONVERT_DRAFT_ORDER,
    {
      refetchQueries: [
        { query: GET_DRAFT_ORDERS, variables: { page: 1, limit: 50 } },
      ],
      onCompleted: (resp) => {
        sileo.success({ title: t("toastOrderCreated") })
        const orderId = resp?.convertDraftOrder?.data?.order_id
        if (orderId) router.push(`${ordersBase}/${orderId}`)
        else router.push(draftsBase)
      },
      onError: (err) =>
        sileo.error({ title: describeError(err, err.message) }),
    },
  )
  const [remove, removeState] = useMutation(DELETE_DRAFT_ORDER, {
    refetchQueries: [
      { query: GET_DRAFT_ORDERS, variables: { page: 1, limit: 50 } },
    ],
    onCompleted: () => {
      sileo.success({ title: t("toastDeleted") })
      router.push(draftsBase)
    },
    onError: (err) => sileo.error({ title: err.message }),
  })
  const saving = createState.loading || updateState.loading

  function buildInput() {
    return {
      lines: catalogLines.map((l) => ({
        product_id: l.product_id,
        variation_option_id: l.variation_option_id,
        quantity: l.quantity,
      })),
      customer_id: customerId,
      customer_name: customerName.trim() || null,
      customer_contact: customerContact.trim() || null,
      note: note.trim() || null,
      manual_discount_cents: discountCents,
      shipping_override_cents: shippingOverrideCents,
      shipping_rule_id: shippingMethodId,
      shipping_method_name: shippingName.trim() || null,
      shipping_address: addressIsEmpty(address)
        ? null
        : {
            street_address: address.street_address.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            zip: address.zip.trim(),
            country: address.country.trim(),
          },
      tags,
      // Stored on the draft, and read by conversion when no gateway is named.
      // The terms go even while unticked: they are the select's value, and
      // the server reads them only for an INVOICE conversion.
      payment_due_later: paymentDueLater,
      payment_terms: paymentTerms,
      // Ids only: createOrder prices them at conversion, for the customer.
      coupon_ids: coupons.map((c) => c.id),
    }
  }

  function assertCanPersist(): boolean {
    if (hasCustom) {
      const msg = t("customItemsBlockSave")
      sileo.error({ title: msg })
      setBarError(msg)
      return false
    }
    if (catalogLines.length === 0) {
      const msg = t("needProduct")
      sileo.error({ title: msg })
      setBarError(msg)
      return false
    }
    return true
  }

  function submit() {
    setBarError(null)
    if (!assertCanPersist()) return
    const input = buildInput()
    if (mode === "edit" && draft) {
      void update({ variables: { input: { id: draft.id, ...input } } })
    } else {
      void create({
        variables: { input },
        onCompleted: (resp) => {
          sileo.success({ title: t("toastCreated") })
          const id = resp?.createDraftOrder?.data?.id
          if (id) {
            setBaseline(staged)
            router.push(`${draftsBase}/${id}`)
          }
        },
      })
    }
  }

  async function createAndConvert() {
    setBarError(null)
    if (!assertCanPersist()) return
    if (dirty && mode === "edit" && draft) {
      const msg = t("saveBeforeConvert")
      sileo.error({ title: msg })
      return
    }
    try {
      let id = draft?.id
      if (mode === "create" || !id) {
        const { data } = await create({ variables: { input: buildInput() } })
        id = data?.createDraftOrder?.data?.id
        if (!id) throw new Error(t("createFailed"))
        setBaseline(staged)
      }
      // Named explicitly: CASH for "Mark as paid", INVOICE for "Payment due
      // later". Sending only the id used to make every order cash on delivery.
      // The saved draft carries the same flag (edit mode refuses to convert
      // with unsaved changes), so this never disagrees with what was stored.
      await convert({
        variables: {
          input: { id, payment_gateway: draftConvertGateway(paymentDueLater) },
        },
      })
    } catch (err) {
      sileo.error({
        title:
          err instanceof Error
            ? describeError(err, err.message)
            : t("convertFailed"),
      })
    }
  }

  function discard() {
    setLines(baseline.lines)
    setCustomerId(baseline.customerId)
    setCustomerName(baseline.customerName)
    setCustomerContact(baseline.customerContact)
    setNote(baseline.note)
    setDiscountCents(baseline.discountCents)
    setDiscountReason(baseline.discountReason)
    setShippingOverrideCents(baseline.shippingOverrideCents)
    setShippingName(baseline.shippingName)
    setShippingMethodId(baseline.shippingMethodId)
    setAddress(baseline.address)
    setTags(baseline.tags)
    setPaymentDueLater(baseline.paymentDueLater)
    setPaymentTerms(baseline.paymentTerms)
    setCoupons(baseline.coupons)
    setBarError(null)
  }

  const barVisible = dirty || mode === "create"
  useEffect(() => {
    if (!barVisible) {
      hideBar()
      return
    }
    showBar({
      label: mode === "create" ? t("unsavedDraft") : t("unsavedChanges"),
      saving,
      onSave: submit,
      onDiscard: mode === "create" ? () => router.back() : discard,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barVisible, saving, normalize(staged), locale])
  useEffect(() => () => hideBar(), [hideBar])

  // Handed to the terms select's root as `items`: without them Base UI's
  // SelectValue prints the raw term ("net_30") in the trigger, not its label.
  const paymentTermOptions: { value: DraftPaymentTerm; label: string }[] = [
    { value: "due_on_receipt", label: t("termsDueOnReceipt") },
    { value: "net_7", label: t("termsNet7") },
    { value: "net_15", label: t("termsNet15") },
    { value: "net_30", label: t("termsNet30") },
  ]

  const isOpen = mode === "create" || draft?.status === "open"
  const converted = draft?.status === "completed"
  const hasCustomer =
    Boolean(customerId) || Boolean(customerName.trim()) || Boolean(customerContact.trim())
  const hasAddress = !addressIsEmpty(address)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={draftsBase}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("backToDrafts")}
          >
            <ChevronLeftIcon className="size-5 rtl:rotate-180" />
          </Link>
          <FilePlus2Icon className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? t("editTitle") : t("createTitle")}
          </h1>
        </div>
        {mode === "edit" && draft && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm(t("deleteConfirm")))
                  void remove({ variables: { id: draft.id } })
              }}
              disabled={removeState.loading}
            >
              <Trash2Icon className="size-4" />
              {t("delete")}
            </Button>
          </div>
        )}
      </div>

      {converted && draft?.order_id ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("convertedBanner")}{" "}
          <Link
            href={`${ordersBase}/${draft.order_id}`}
            className="font-medium text-foreground underline"
          >
            {t("viewOrder")}
          </Link>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          {/* Products */}
          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("products")}</h2>
              {lines.length > 0 && isOpen ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomOpen(true)}
                  >
                    <PlusIcon className="size-3.5" />
                    {t("customItem")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                  >
                    <PlusIcon className="size-3.5" />
                    {t("product")}
                  </Button>
                </div>
              ) : null}
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOpen}
                  onClick={() => setCustomOpen(true)}
                >
                  <PlusIcon className="size-3.5" />
                  {t("customItem")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOpen}
                  onClick={() => setPickerOpen(true)}
                >
                  <PlusIcon className="size-3.5" />
                  {t("product")}
                </Button>
              </div>
            ) : (
              <ul className="divide-y border-t border-border">
                {lines.map((l) => (
                  <li
                    key={l.product_id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                      {l.image ? (
                        <Image
                          src={l.image}
                          alt={l.name}
                          width={44}
                          height={44}
                          className="size-11 object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImageIcon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      {l.is_custom ? (
                        <p className="text-xs text-muted-foreground">
                          {t("customBadge")}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-sm tabular-nums text-primary">
                      {formatMoneyCents(l.unit_price_cents, currency)}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={l.quantity}
                      disabled={!isOpen}
                      onChange={(e) =>
                        setQty(l.product_id, Number(e.target.value) || 1)
                      }
                      className="h-8 w-14 text-center tabular-nums"
                      aria-label={t("quantity")}
                    />
                    <span className="w-24 text-end text-sm font-medium tabular-nums">
                      {formatMoneyCents(
                        l.unit_price_cents * l.quantity,
                        currency,
                      )}
                    </span>
                    {isOpen ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLine(l.product_id)}
                        aria-label={t("removeProduct")}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Payment */}
          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("payment")}</h2>
              {lines.length > 0 && isOpen ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!assertCanPersist()) return
                      if (mode === "create" || !draft) {
                        sileo.error({ title: t("saveBeforeSendInvoice") })
                        return
                      }
                      if (dirty) {
                        sileo.error({ title: t("saveBeforeSendInvoice") })
                        return
                      }
                      setSendInvoiceOpen(true)
                    }}
                  >
                    {t("sendInvoice")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={convertState.loading || createState.loading}
                    onClick={() => void createAndConvert()}
                  >
                    {paymentDueLater ? t("createOrder") : t("markAsPaid")}
                  </Button>
                </div>
              ) : null}
            </div>

            {lines.length === 0 ? (
              <div className="border-t border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {t("addProductToCalculate")}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("subtotal")}
                      <span className="ms-1 text-xs">
                        ({t("itemCount", { count: itemCount })})
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {formatMoneyCents(subtotalCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-50"
                      disabled={!isOpen}
                      onClick={() => setDiscountOpen(true)}
                    >
                      {discountCents > 0
                        ? discountReason || t("discount")
                        : t("addDiscount")}
                    </button>
                    <span className="tabular-nums text-muted-foreground">
                      {appliedDiscount > 0
                        ? `−${formatMoneyCents(appliedDiscount, currency)}`
                        : "—"}
                    </span>
                  </div>
                  {coupons.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 truncate text-start text-primary hover:underline disabled:opacity-50"
                          disabled={!isOpen}
                          onClick={() => setDiscountOpen(true)}
                        >
                          {t("storeDiscounts")}:{" "}
                          {coupons
                            .map((c) => draftCouponLabel(c, t("couponAutomatic")))
                            .join(", ")}
                        </button>
                        <span
                          className="shrink-0 tabular-nums text-muted-foreground"
                          data-testid="draft-coupon-estimate"
                        >
                          {couponEstimateCents > 0 ? (
                            <>
                              −{formatMoneyCents(couponEstimateCents, currency)}{" "}
                              <span className="text-xs">({t("estimate")})</span>
                            </>
                          ) : (
                            t("couponPricedAtConversion")
                          )}
                        </span>
                      </div>
                      {couponWarning ? (
                        <p className="text-xs text-destructive">{couponWarning}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-50"
                      disabled={!isOpen}
                      onClick={() => setShippingOpen(true)}
                    >
                      {shippingOverrideCents !== null
                        ? shippingName || t("shipping")
                        : t("addShipping")}
                    </button>
                    <span className="tabular-nums text-muted-foreground">
                      {shippingOverrideCents !== null
                        ? formatMoneyCents(shippingOverrideCents, currency)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("estimatedTax")}
                      {taxBps > 0 ? (
                        <span className="ms-1 text-xs">
                          ({(taxBps / 100).toFixed(taxBps % 100 === 0 ? 0 : 1)}
                          % {t("vat")})
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {taxBps > 0
                        ? formatMoneyCents(estimatedTaxCents, currency)
                        : t("taxNotCalculated")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5 font-semibold">
                    <span>{t("total")}</span>
                    <span className="tabular-nums">
                      {formatMoneyCents(totalCents, currency)} {currency}
                    </span>
                  </div>
                  {coupons.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("couponEstimateNote")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={paymentDueLater}
                      disabled={!isOpen}
                      onCheckedChange={(v) => setPaymentDueLater(v === true)}
                    />
                    {t("paymentDueLater")}
                  </label>
                  {paymentDueLater ? (
                    <div className="flex flex-col gap-1.5 ps-6">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("paymentTerms")}
                      </span>
                      <Select
                        items={paymentTermOptions}
                        value={paymentTerms}
                        onValueChange={(v) => {
                          if (v) setPaymentTerms(readDraftPaymentTerm(v))
                        }}
                        disabled={!isOpen}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTermOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("paymentTermsHint")}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("notes")}</h2>
              {isOpen ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("editNotes")}
                  onClick={() => setNoteOpen(true)}
                >
                  <PencilIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!isOpen}
              onClick={() => setNoteOpen(true)}
              className="w-full px-4 pb-3 text-start text-sm text-muted-foreground disabled:opacity-60"
            >
              {note.trim() || t("noNotes")}
            </button>
          </Card>

          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("customer")}</h2>
              {hasCustomer && isOpen ? (
                <Button variant="ghost" size="sm" onClick={clearCustomer}>
                  {t("remove")}
                </Button>
              ) : null}
            </div>
            <div className="px-4 pb-3">
              {hasCustomer ? (
                <button
                  type="button"
                  disabled={!isOpen}
                  onClick={() => setCustomerPickerOpen(true)}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-start text-sm hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-60"
                >
                  <p className="font-medium">
                    {customerName || t("unnamedCustomer")}
                  </p>
                  {customerContact ? (
                    <p className="text-xs text-muted-foreground">
                      {customerContact}
                    </p>
                  ) : null}
                  {hasAddress ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        address.street_address,
                        address.city,
                        address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                </button>
              ) : (
                // Use a <button>, not a focused Input: opening the dialog from
                // onFocus mid-mousedown mounts the backdrop under the still-
                // held pointer, so the mouseup dismisses it immediately.
                <button
                  type="button"
                  disabled={!isOpen}
                  onClick={() => setCustomerPickerOpen(true)}
                  className="relative flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-start text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SearchIcon className="absolute start-2.5 size-4 text-muted-foreground" />
                  <span className="truncate ps-6">{t("searchOrAddCustomer")}</span>
                </button>
              )}
              {hasCustomer && !hasAddress && isOpen ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Input
                    placeholder={t("street")}
                    value={address.street_address}
                    onChange={(e) =>
                      setAddress((a) => ({
                        ...a,
                        street_address: e.target.value,
                      }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={t("city")}
                      value={address.city}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, city: e.target.value }))
                      }
                    />
                    <Input
                      placeholder={t("country")}
                      value={address.country}
                      onChange={(e) =>
                        setAddress((a) => ({
                          ...a,
                          country: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("markets")}</h2>
              <NetworkIcon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                <GlobeIcon className="size-3.5" />
                {marketLabel}
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("currency")}
                </span>
                <Select value={currency} disabled>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue>
                      {currencyDisplayLabel(currency, locale)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currency}>
                      {currencyDisplayLabel(currency, locale)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="gap-0 overflow-hidden p-0 shadow-none ring-1 ring-foreground/10">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">{t("tags")}</h2>
              <PencilIcon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="px-4 pb-3">
              {tags.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      {tag}
                      {isOpen ? (
                        <button
                          type="button"
                          aria-label={t("removeTag")}
                          onClick={() =>
                            setTags((prev) => prev.filter((x) => x !== tag))
                          }
                        >
                          <XIcon className="size-3" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
              <Input
                value={tagInput}
                disabled={!isOpen}
                placeholder={t("addTags")}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTagFromInput()
                  }
                }}
                onBlur={addTagFromInput}
              />
            </div>
          </Card>
        </div>
      </div>

      <DraftProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingIds={existingIds}
        currency={currency}
        onAdd={addProducts}
      />
      <CustomItemDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        currency={currency}
        onAdd={addCustom}
      />
      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        onSelect={applyCustomer}
        onCreateNew={() => {
          // Open after the picker closes so two Dialog roots don't fight focus.
          queueMicrotask(() => setNewCustomerOpen(true))
        }}
      />
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreated={applyCustomer}
      />
      <AddNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        value={note}
        onDone={setNote}
        disabled={!isOpen}
      />
      <AddDiscountDialog
        open={discountOpen}
        onOpenChange={setDiscountOpen}
        currency={currency}
        valueCents={discountCents}
        reason={discountReason}
        subtotalCents={subtotalCents}
        coupons={coupons}
        lines={catalogLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price_cents: l.unit_price_cents,
        }))}
        hasCustomerAccount={Boolean(customerId)}
        customerId={customerId}
        shippingCents={shippingCents}
        onDone={({ cents, reason, coupons: nextCoupons }) => {
          setDiscountCents(cents)
          setDiscountReason(reason)
          setCoupons(nextCoupons)
        }}
        disabled={!isOpen}
      />
      <ShippingOptionsDialog
        open={shippingOpen}
        onOpenChange={setShippingOpen}
        currency={currency}
        overrideCents={shippingOverrideCents}
        name={shippingName}
        customerId={customerId}
        hasCustomerAddress={hasAddress}
        products={catalogLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          variation_option_id: l.variation_option_id,
        }))}
        shippingAddress={hasAddress ? address : null}
        onDone={({ overrideCents, name, methodId }) => {
          setShippingOverrideCents(overrideCents)
          setShippingName(name)
          setShippingMethodId(methodId)
        }}
        disabled={!isOpen}
      />
      {draft ? (
        <SendInvoiceDialog
          open={sendInvoiceOpen}
          onOpenChange={setSendInvoiceOpen}
          draft={draft}
          totalCents={totalCents}
          currency={currency}
        />
      ) : null}
    </div>
  )
}
