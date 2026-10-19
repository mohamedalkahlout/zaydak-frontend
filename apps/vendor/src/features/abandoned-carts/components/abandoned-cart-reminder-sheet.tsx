"use client"

import { useRef, useState, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { format, isValid, parse } from "date-fns"
import { arSA, enUS } from "react-day-picker/locale"
import { CalendarIcon, EyeIcon } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@repo/ui/components/input-group"
import { Label } from "@repo/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Switch } from "@repo/ui/components/switch"
import { Textarea } from "@repo/ui/components/textarea"
import { Input } from "@repo/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet"
import { cn } from "@/shared/lib/utils"
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import {
  GET_ABANDONED_CART_STATUS_COUNTS,
  GET_ABANDONED_CARTS,
  GET_ABANDONED_CARTS_BY_PRODUCT,
  GET_ABANDONED_CARTS_SUMMARY,
  SEND_ABANDONED_CART_REMINDER,
} from "@/features/abandoned-carts/api"
import type {
  AbandonedCart,
  AbandonedCartChannel,
  SendAbandonedCartReminderResponse,
} from "@/features/abandoned-carts/types"
import {
  MERGE_TAGS,
  defaultReminderBody,
  defaultReminderTitle,
  insertMergeTag,
  samplePreviewValues,
  substituteMergeTags,
  type MergeTag,
} from "@/features/abandoned-carts/lib/message"

const CHANNELS: AbandonedCartChannel[] = ["SMS", "EMAIL", "WHATSAPP"]
const TAG_ORDER: MergeTag[] = [
  "name",
  "discount_amount",
  "date",
  "shop_name",
  "cart_url",
  "discount_code",
]

export function AbandonedCartReminderSheet({
  carts,
  open,
  onOpenChange,
}: {
  carts: AbandonedCart[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("abandonedCarts")
  const locale = resolveLocale(useLocale())
  const side = LOCALE_DIRECTIONS[locale] === "rtl" ? "left" : "right"
  const seedKey = carts.map((c) => c.id).join(",")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState(defaultReminderBody(locale))
  const [withDiscount, setWithDiscount] = useState(false)
  const [percent, setPercent] = useState("")
  const [expiry, setExpiry] = useState("")
  const [expiryOpen, setExpiryOpen] = useState(false)
  const [today] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [freeShipping, setFreeShipping] = useState(false)
  const [channels, setChannels] = useState<AbandonedCartChannel[]>(["EMAIL"])
  const [seededFrom, setSeededFrom] = useState<string | null>(null)

  if (open && seedKey && seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    setTitle(defaultReminderTitle(locale))
    setWithDiscount(false)
    setBody(defaultReminderBody(locale, false))
    setPercent("")
    setExpiry("")
    setFreeShipping(false)
    const initial = CHANNELS.filter((channel) =>
      carts.every((cart) => channelAvailable(cart, channel)),
    )
    setChannels(initial.length ? initial : [])
  }
  if (!open && seededFrom !== null) {
    setSeededFrom(null)
  }

  const client = useApolloClient()
  const [send] = useMutation<SendAbandonedCartReminderResponse>(
    SEND_ABANDONED_CART_REMINDER,
  )
  // A run is one mutation per cart, in order, and a selection can now span
  // the whole list — so the run reports where it is, and can be stopped.
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const sending = progress !== null
  // Set by closing the sheet mid-run. Read between sends, never in render.
  const stopRequested = useRef(false)

  const expiryDate = expiry ? parse(expiry, "yyyy-MM-dd", new Date()) : undefined
  const expiryLabel =
    expiryDate && isValid(expiryDate)
      ? expiryDate.toLocaleDateString(locale, {
          month: "long",
          day: "numeric",
          year: "numeric",
          numberingSystem: "latn",
        })
      : ""

  // Derived in render, not in a `useMemo`: a few string substitutions cost
  // less than the memo, and the manual one could not be preserved by the
  // React Compiler (it read `locale` and `expiryLabel` as possibly mutated).
  const previewSamples = samplePreviewValues(locale)
  const previewPercent = Number(percent)
  const preview = substituteMergeTags(body, {
    ...previewSamples,
    name: carts[0]?.customer?.name || previewSamples.name,
    discount_code:
      withDiscount || freeShipping ? previewSamples.discount_code : "",
    discount_amount:
      withDiscount && Number.isFinite(previewPercent) && previewPercent >= 1
        ? `${Math.round(previewPercent)}%`
        : "",
    date: expiryLabel,
  })

  const toggleChannel = (channel: AbandonedCartChannel, on: boolean) => {
    setChannels((prev) =>
      on ? [...new Set([...prev, channel])] : prev.filter((c) => c !== channel),
    )
  }

  const submit = async () => {
    if (carts.length === 0) return
    const parsed = Number(percent)
    const discountPercent =
      withDiscount && Number.isFinite(parsed) && parsed >= 1 && parsed <= 100
        ? Math.round(parsed)
        : undefined
    let ok = 0
    let fail = 0
    const targets = carts
    stopRequested.current = false
    setProgress({ done: 0, total: targets.length })
    for (const cart of targets) {
      // Closing the sheet stops the run before the next customer, not
      // half-way through one: whoever was already sent to stays sent.
      if (stopRequested.current) break
      try {
        const result = await send({
          variables: {
            input: {
              cart_id: cart.id,
              channels,
              title: title.trim() || undefined,
              body,
              discount_percent: discountPercent,
              discount_expires_at:
                withDiscount && expiry
                  ? new Date(expiry).toISOString()
                  : undefined,
              free_shipping: freeShipping || undefined,
            },
          },
        })
        if (!result.data?.sendAbandonedCartReminder?.success) {
          throw new Error("send failed")
        }
        ok += 1
      } catch {
        fail += 1
      }
      setProgress({ done: ok + fail, total: targets.length })
    }
    setProgress(null)
    // One refetch for the run. It used to ride on every send, which for a
    // long selection was four queries per customer.
    if (ok + fail > 0) {
      await client
        .refetchQueries({
          include: [
            GET_ABANDONED_CARTS,
            GET_ABANDONED_CARTS_BY_PRODUCT,
            GET_ABANDONED_CARTS_SUMMARY,
            GET_ABANDONED_CART_STATUS_COUNTS,
          ],
        })
        .catch(() => undefined)
    }
    const left = targets.length - ok - fail
    if (left > 0) {
      // The sheet is already closed; say what the run got through.
      sileo.info({ title: t("toasts.sendStopped", { ok, fail, left }) })
      return
    }
    if (ok > 0 && fail === 0) {
      sileo.success({
        title: carts.length > 1 ? t("toasts.sentMany", { count: ok }) : t("toasts.sent"),
      })
      onOpenChange(false)
      return
    }
    if (ok > 0) {
      sileo.success({ title: t("toasts.sentPartial", { ok, fail }) })
      onOpenChange(false)
      return
    }
    sileo.error({ title: t("toasts.sendFailed") })
  }

  const channelDisabled = (channel: AbandonedCartChannel) => {
    if (carts.length === 0) return true
    return carts.some((cart) => !channelAvailable(cart, channel))
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && sending) stopRequested.current = true
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={side}
        className="flex w-full flex-col gap-0 sm:max-w-[26rem]"
        closeLabel={t("reminder.close")}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {carts.length > 1
              ? t("reminder.titleMany", { count: carts.length })
              : t("reminder.title")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="abandoned-with-discount">
                {t("reminder.withDiscount")}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("reminder.withDiscountHint")}
              </p>
            </div>
            <Switch
              id="abandoned-with-discount"
              checked={withDiscount}
              onCheckedChange={(on) => {
                setWithDiscount(on)
                const current = body.trim()
                const without = defaultReminderBody(locale, false).trim()
                const withBody = defaultReminderBody(locale, true).trim()
                if (!current || current === without || current === withBody) {
                  setBody(defaultReminderBody(locale, on))
                }
                if (on && !percent) setPercent("10")
              }}
            />
          </div>

          {withDiscount ? (
            <>
              <Field
                label={t("reminder.expiry")}
                htmlFor="abandoned-discount-expiry"
              >
                <Popover open={expiryOpen} onOpenChange={setExpiryOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="abandoned-discount-expiry"
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full justify-between font-normal",
                          !expiryLabel && "text-muted-foreground",
                        )}
                      >
                        {expiryLabel || t("reminder.expiryPlaceholder")}
                        <CalendarIcon className="size-4 text-muted-foreground" />
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={locale === "ar" ? arSA : enUS}
                      selected={
                        expiryDate && isValid(expiryDate) ? expiryDate : undefined
                      }
                      disabled={{ before: today }}
                      onSelect={(d) => {
                        setExpiry(d ? format(d, "yyyy-MM-dd") : "")
                        setExpiryOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              <Field
                label={t("reminder.percent")}
                htmlFor="abandoned-discount-percent"
              >
                <InputGroup className="h-9">
                  <InputGroupInput
                    id="abandoned-discount-percent"
                    type="number"
                    min={1}
                    max={100}
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>%</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </>
          ) : null}

          <div className="space-y-2">
            <Label>
              {t("reminder.channels")}
              <RequiredMark />
            </Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {CHANNELS.map((channel) => (
                <label
                  key={channel}
                  className={cn(
                    "inline-flex items-center gap-2 text-sm",
                    channelDisabled(channel) && "text-muted-foreground",
                  )}
                >
                  <Checkbox
                    checked={channels.includes(channel)}
                    disabled={channelDisabled(channel)}
                    onCheckedChange={(c) => toggleChannel(channel, c === true)}
                  />
                  {t(`channels.${channel}`)}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("reminder.channelsHint")}</p>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="abandoned-free-shipping">
                {t("reminder.freeShipping")}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("reminder.freeShippingHint")}
              </p>
            </div>
            <Switch
              id="abandoned-free-shipping"
              checked={freeShipping}
              onCheckedChange={setFreeShipping}
            />
          </div>

          <Field
            label={t("reminder.messageTitle")}
            htmlFor="abandoned-reminder-title"
            required
          >
            <Input
              id="abandoned-reminder-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("reminder.titlePlaceholder")}
              className="h-9"
            />
          </Field>

          <div className="space-y-2">
            <Label htmlFor="abandoned-reminder-body">
              {t("reminder.body")}
              <RequiredMark />
            </Label>
            <Textarea
              id="abandoned-reminder-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
            <div className="flex flex-wrap gap-1.5">
              {TAG_ORDER.filter((tag) => MERGE_TAGS.includes(tag)).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full text-xs font-normal"
                  onClick={() => setBody((prev) => insertMergeTag(prev, tag))}
                >
                  {t(`tags.${tag}`)}
                  <span className="text-muted-foreground">({tag})</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <EyeIcon className="size-3.5" />
              {t("reminder.preview")}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="w-fit max-w-[92%] rounded-2xl rounded-es-md bg-primary/20 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {preview}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t border-border">
          <Button
            className="w-full"
            onClick={submit}
            disabled={sending || channels.length === 0 || carts.length === 0 || !body.trim()}
          >
            {!progress
              ? t("reminder.send")
              : progress.total > 1
                ? t("reminder.sendingProgress", {
                    done: progress.done,
                    total: progress.total,
                  })
                : t("reminder.sending")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function channelAvailable(
  cart: AbandonedCart,
  channel: AbandonedCartChannel,
): boolean {
  if (channel === "EMAIL") return cart.channels.email
  if (channel === "SMS") return cart.channels.sms
  return cart.channels.whatsapp
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
    </div>
  )
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}
