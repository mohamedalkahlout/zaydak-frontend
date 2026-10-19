"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Skeleton } from "@repo/ui/components/skeleton"
import { DRAFT_COUPON_OPTIONS } from "@/features/orders/api"
import { VERIFY_COUPON } from "@/features/coupons/api"
import type {
  VerifyCouponResponse,
  VerifyCouponResponseData,
} from "@/features/coupons/types"
import {
  couponRowRequiresCustomer,
  draftCouponLabel,
  MAX_DRAFT_COUPONS,
  type DraftCouponPick,
} from "@/features/orders/lib/drafts/coupons"
import {
  centsToMajor,
  formatMoneyCents,
  majorToCents,
} from "@/shared/lib/format"

type DiscountType = "amount" | "percent"

/** A row of the shop's active coupons (`DRAFT_COUPON_OPTIONS`). */
interface DraftCouponOption {
  id: string
  code?: string | null
  description?: string | null
  type?: string | null
  value_type?: string | null
  amount_cents?: number | null
  percent_bps?: number | null
  method?: string | null
  eligibility?: string | null
  max_uses_per_user?: number | null
}

interface DraftCouponOptionsResult {
  coupons?: { data?: DraftCouponOption[] | null } | null
}

/** A catalogue line, as VERIFY_COUPON's preview reads it. */
export interface DraftCouponLine {
  product_id: string
  quantity: number
  unit_price_cents: number
}

interface AddDiscountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  /** Current flat discount in cents (amount mode only is persisted). */
  valueCents: number
  reason: string
  subtotalCents: number
  /** Store coupons staged on the draft. */
  coupons: DraftCouponPick[]
  /** The draft's catalogue lines, for the coupon preview. */
  lines: DraftCouponLine[]
  /** Whether the draft has a customer account (per-customer coupons need one). */
  hasCustomerAccount: boolean
  customerId?: string | null
  shippingCents?: number | null
  onDone: (next: {
    cents: number
    reason: string
    coupons: DraftCouponPick[]
  }) => void
  disabled?: boolean
}

type CodeErrorKey =
  | "couponNotFound"
  | "couponExpired"
  | "couponNotYetActive"
  | "couponNotApplicable"

function codeErrorKey(reason?: string | null): CodeErrorKey {
  switch (reason) {
    case "not_found":
      return "couponNotFound"
    case "expired":
      return "couponExpired"
    case "not_yet_active":
      return "couponNotYetActive"
    default:
      return "couponNotApplicable"
  }
}

/**
 * What a preview says about a coupon. Free shipping has no figure until the
 * order's shipping is priced, so it carries none rather than a misleading 0.
 */
function previewOutcome(
  res: VerifyCouponResponseData | null,
): Pick<DraftCouponPick, "estimateCents" | "previewFailed"> {
  if (!res?.is_valid) return { estimateCents: null, previewFailed: true }
  if (String(res.coupon?.type ?? "").toUpperCase() === "FREE_SHIPPING") {
    return {
      estimateCents: res.discount_preview?.total_cents ?? null,
      previewFailed: false,
    }
  }
  return {
    estimateCents: res.discount_preview?.total_cents ?? null,
    previewFailed: false,
  }
}

function pickFromRow(
  row: DraftCouponOption,
  outcome: Pick<DraftCouponPick, "estimateCents" | "previewFailed">,
): DraftCouponPick {
  return {
    id: row.id,
    code: row.code ?? null,
    description: row.description ?? null,
    available: true,
    requiresCustomer: couponRowRequiresCustomer(row),
    ...outcome,
  }
}

/**
 * Shopify-style "Add discount" modal: the shop's store coupons, and a custom
 * flat amount (or percent of the current subtotal).
 *
 * Coupons are staged by ID (`coupon_ids`); the draft never prices them.
 * `createOrder` does, when the draft converts, for the draft's CUSTOMER. The
 * figure shown here comes from VERIFY_COUPON, which evaluates for the signed-
 * in merchant and the lines as staged, so it is labelled as an estimate and a
 * coupon the preview cannot price (customer targeting, a per-customer cap, a
 * collection scope the dashboard does not know) can still be added: the
 * conversion decides. A coupon is never folded into `manual_discount_cents`.
 */
export function AddDiscountDialog({
  open,
  onOpenChange,
  currency,
  valueCents,
  reason,
  subtotalCents,
  coupons,
  lines,
  hasCustomerAccount,
  customerId,
  shippingCents,
  onDone,
  disabled,
}: AddDiscountDialogProps) {
  const t = useTranslations("draftOrders.form")
  // Handed to the select's root as `items`: without them Base UI's SelectValue
  // prints the raw value ("amount") in the trigger instead of its label.
  const typeOptions: { value: DiscountType; label: string }[] = [
    { value: "amount", label: t("discountTypeAmount") },
    { value: "percent", label: t("discountTypePercent") },
  ]
  const [custom, setCustom] = useState(valueCents > 0 || reason.length > 0)
  const [type, setType] = useState<DiscountType>("amount")
  const [amountMajor, setAmountMajor] = useState(
    valueCents ? String(centsToMajor(valueCents)) : "",
  )
  const [percent, setPercent] = useState("")
  const [reasonDraft, setReasonDraft] = useState(reason)
  const [picks, setPicks] = useState<DraftCouponPick[]>(coupons)
  const [query, setQuery] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCustom(valueCents > 0 || reason.length > 0)
      setType("amount")
      setAmountMajor(valueCents ? String(centsToMajor(valueCents)) : "")
      setPercent("")
      setReasonDraft(reason)
      setPicks(coupons)
      setQuery("")
      setCodeError(null)
    }
  }

  const { data: optionsData, loading: optionsLoading } =
    useQuery<DraftCouponOptionsResult>(DRAFT_COUPON_OPTIONS, {
      variables: { limit: 50, search: query.trim() || undefined },
      skip: !open,
      fetchPolicy: "cache-and-network",
    })
  const options = optionsData?.coupons?.data ?? []
  const [verify, verifyState] = useMutation<VerifyCouponResponse>(VERIFY_COUPON)

  const atLimit = picks.length >= MAX_DRAFT_COUPONS
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options.filter(
        (o) =>
          (o.code ?? "").toLowerCase().includes(needle) ||
          (o.description ?? "").toLowerCase().includes(needle),
      )
    : options

  /** VERIFY_COUPON for the staged lines. Null when the call itself failed. */
  async function runPreview(
    code: string,
    applied: string[],
  ): Promise<VerifyCouponResponseData | null> {
    try {
      const result = await verify({
        variables: {
          input: {
            code,
            sub_total_cents: subtotalCents,
            items: lines.map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              price_cents: l.unit_price_cents,
            })),
            ...(applied.length > 0 ? { applied_coupons: applied } : {}),
            ...(customerId ? { customer_id: customerId } : {}),
            ...(shippingCents != null ? { shipping_rate_cents: shippingCents } : {}),
          },
        },
      })
      return result.data?.verifyCoupon ?? null
    } catch {
      return null
    }
  }

  const appliedCodes = () =>
    picks.map((p) => p.code).filter((c): c is string => Boolean(c))

  async function toggleRow(row: DraftCouponOption, checked: boolean) {
    if (!checked) {
      setPicks((prev) => prev.filter((p) => p.id !== row.id))
      return
    }
    if (atLimit || picks.some((p) => p.id === row.id)) return
    const applied = appliedCodes()
    setPicks((prev) => [
      ...prev,
      pickFromRow(row, { estimateCents: null, previewFailed: false }),
    ])
    // An automatic coupon has no code to preview; conversion prices it.
    if (!row.code) return
    const outcome = previewOutcome(await runPreview(row.code, applied))
    setPicks((prev) =>
      prev.map((p) => (p.id === row.id ? { ...p, ...outcome } : p)),
    )
  }

  async function applyCode() {
    const code = query.trim()
    if (!code) return
    if (atLimit) {
      setCodeError(t("couponLimitReached", { max: MAX_DRAFT_COUPONS }))
      return
    }
    const same = (c?: string | null) => c?.toLowerCase() === code.toLowerCase()
    if (picks.some((p) => same(p.code))) {
      setCodeError(t("couponAlreadyApplied"))
      return
    }
    setCodeError(null)
    const res = await runPreview(code, appliedCodes())
    const row = options.find((o) => same(o.code))
    if (res?.is_valid && res.coupon?.id) {
      const couponId = res.coupon.id
      setPicks((prev) =>
        prev.some((p) => p.id === couponId)
          ? prev
          : [
              ...prev,
              {
                id: couponId,
                code: res.coupon?.code ?? code,
                description: row?.description ?? null,
                available: true,
                requiresCustomer: row ? couponRowRequiresCustomer(row) : false,
                ...previewOutcome(res),
              },
            ],
      )
      setQuery("")
      return
    }
    // One of the shop's active coupons that the preview could not price for
    // the merchant. Whether it applies to the draft's customer is decided at
    // conversion, so it is added with no figure.
    if (row) {
      setPicks((prev) =>
        prev.some((p) => p.id === row.id)
          ? prev
          : [...prev, pickFromRow(row, { estimateCents: null, previewFailed: true })],
      )
      setQuery("")
      return
    }
    setCodeError(res ? t(codeErrorKey(res.reason_code)) : t("couponCheckFailed"))
  }

  function pickStatus(p: DraftCouponPick): { text: string; warn: boolean } {
    if (!p.available) return { text: t("couponUnavailable"), warn: true }
    if (p.requiresCustomer && !hasCustomerAccount) {
      return { text: t("couponNeedsCustomer"), warn: true }
    }
    if (p.estimateCents !== null) {
      return {
        text: t("couponEstimateValue", {
          amount: formatMoneyCents(p.estimateCents, currency),
        }),
        warn: false,
      }
    }
    if (p.previewFailed) return { text: t("couponPreviewUnavailable"), warn: false }
    return { text: t("couponPricedAtConversion"), warn: false }
  }

  function optionValue(o: DraftCouponOption): string {
    const kind = String(o.type ?? "").toUpperCase()
    if (kind === "FREE_SHIPPING") return t("couponFreeShipping")
    if (kind === "BUY_X_GET_Y") return t("couponBuyXGetY")
    if (String(o.value_type ?? "").toUpperCase() === "PERCENTAGE") {
      return `${(o.percent_bps ?? 0) / 100}%`
    }
    return formatMoneyCents(o.amount_cents ?? 0, currency)
  }

  function resolveCents(): number {
    if (!custom) return 0
    if (type === "percent") {
      const pct = Number(percent) || 0
      return Math.min(
        subtotalCents,
        Math.max(0, Math.round((subtotalCents * pct) / 100)),
      )
    }
    return Math.min(
      subtotalCents,
      Math.max(0, majorToCents(Number(amountMajor) || 0)),
    )
  }

  const canDone = custom && resolveCents() >= 0 && (type === "amount" ? amountMajor !== "" || valueCents > 0 : percent !== "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("discountModalTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t("discountsHeading")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("storeDiscountsHint")}
              </p>
            </div>

            {picks.length > 0 ? (
              <ul className="flex flex-col gap-1.5" aria-label={t("storeDiscounts")}>
                {picks.map((p) => {
                  const status = pickStatus(p)
                  return (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {draftCouponLabel(p, t("couponAutomatic"))}
                        </p>
                        <p
                          className={
                            status.warn
                              ? "text-xs text-destructive"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {status.text}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("removeCoupon")}
                        disabled={disabled}
                        onClick={() =>
                          setPicks((prev) => prev.filter((x) => x.id !== p.id))
                        }
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setCodeError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void applyCode()
                  }
                }}
                placeholder={t("couponSearchPlaceholder")}
                aria-label={t("couponSearchPlaceholder")}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !query.trim() || verifyState.loading}
                onClick={() => void applyCode()}
              >
                {t("applyCode")}
              </Button>
            </div>
            {codeError ? (
              <p role="alert" className="text-xs text-destructive">
                {codeError}
              </p>
            ) : null}

            <div className="max-h-44 overflow-y-auto">
              {optionsLoading && options.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : visible.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {options.length === 0
                    ? t("noActiveCoupons")
                    : t("noCouponMatches")}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {visible.map((o) => {
                    const checked = picks.some((p) => p.id === o.id)
                    const label = draftCouponLabel(
                      { code: o.code ?? null, description: o.description ?? null },
                      t("couponAutomatic"),
                    )
                    return (
                      <li key={o.id}>
                        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
                          <Checkbox
                            checked={checked}
                            disabled={disabled || (!checked && atLimit)}
                            onCheckedChange={(v) => void toggleRow(o, v === true)}
                          />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {couponRowRequiresCustomer(o) ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {t("couponPerCustomer")}
                            </span>
                          ) : null}
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {optionValue(o)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {atLimit ? (
              <p className="text-xs text-muted-foreground">
                {t("couponLimitReached", { max: MAX_DRAFT_COUPONS })}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={custom}
              onCheckedChange={(v) => setCustom(v === true)}
              disabled={disabled}
            />
            {t("addCustomDiscount")}
          </label>

          {custom ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("discountType")}</Label>
                  <Select
                    items={typeOptions}
                    value={type}
                    onValueChange={(v) => {
                      if (v) setType(v as DiscountType)
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("discountValue")}</Label>
                  {type === "amount" ? (
                    <div className="relative">
                      <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {currency}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amountMajor}
                        onChange={(e) => setAmountMajor(e.target.value)}
                        disabled={disabled}
                        className="ps-12 tabular-nums"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={percent}
                        onChange={(e) => setPercent(e.target.value)}
                        disabled={disabled}
                        className="pe-8 tabular-nums"
                      />
                      <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="discount-reason">{t("discountReason")}</Label>
                <Input
                  id="discount-reason"
                  value={reasonDraft}
                  onChange={(e) => setReasonDraft(e.target.value)}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  {t("discountReasonHint")}
                </p>
              </div>
            </div>
          ) : null}
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
            disabled={disabled || (custom && !canDone)}
            onClick={() => {
              onDone({
                cents: custom ? resolveCents() : 0,
                reason: custom ? reasonDraft.trim() : "",
                coupons: picks,
              })
              onOpenChange(false)
            }}
          >
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
