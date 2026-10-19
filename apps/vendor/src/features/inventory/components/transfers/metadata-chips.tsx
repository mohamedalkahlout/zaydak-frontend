"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import {
  PlusCircle,
  Truck as TruckIcon,
  CalendarDays,
  ScanBarcode,
  Coins,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import { cn } from "@/shared/lib/utils"
import {
  formatAmount,
  formatUtcDay,
  localDayToUtcIso,
  utcIsoToLocalDay,
} from "./transfer-helpers"

export type TransferMetaPatch = {
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_carrier?: string | null
  expected_arrival?: string | null
  barcode?: string | null
  shipment_cost_cents?: number | null
}

/**
 * Shopify's shipment-detail "chips" under the products table. Each chip is a
 * popover editor that stages every change up to the detail page (via `onSave`)
 * so the contextual save bar reacts immediately; the popover's Done just closes
 * it and Cancel reverts the staged change. A chip with no value reads "+ Label".
 */
export function MetadataChips({
  trackingNumber,
  trackingUrl,
  carrier,
  expectedArrival,
  barcode,
  shipmentCostCents,
  onSave,
  locale,
  disabled = false,
}: {
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  expectedArrival: string | null
  barcode: string | null
  shipmentCostCents: number | null
  onSave: (patch: TransferMetaPatch) => void
  locale: string
  disabled?: boolean
}) {
  const t = useTranslations("transfers.chips")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tracking number + URL */}
      <ChipEditor
        icon={<TruckIcon className="size-3.5" />}
        label={t("trackingNumber")}
        value={trackingNumber}
        disabled={disabled}
        render={({ close }) => (
          <TrackingEditor
            number={trackingNumber}
            url={trackingUrl}
            onStage={(number, url) =>
              onSave({ tracking_number: number, tracking_url: url })
            }
            onClose={close}
          />
        )}
      />

      {/* Carrier */}
      <ChipEditor
        icon={<TruckIcon className="size-3.5" />}
        label={t("carrier")}
        value={carrier}
        disabled={disabled}
        render={({ close }) => (
          <SingleFieldEditor
            label={t("carrier")}
            placeholder={t("carrierPlaceholder")}
            value={carrier}
            onStage={(v) => onSave({ shipping_carrier: v })}
            onClose={close}
          />
        )}
      />

      {/* Expected arrival */}
      <ChipEditor
        icon={<CalendarDays className="size-3.5" />}
        label={t("expectedArrival")}
        value={expectedArrival ? formatUtcDay(expectedArrival, locale) : null}
        disabled={disabled}
        render={({ close }) => (
          <ArrivalEditor
            value={expectedArrival}
            onStage={(iso) => onSave({ expected_arrival: iso })}
            onClose={close}
          />
        )}
      />

      {/* Barcode */}
      <ChipEditor
        icon={<ScanBarcode className="size-3.5" />}
        label={t("barcode")}
        value={barcode}
        disabled={disabled}
        render={({ close }) => (
          <SingleFieldEditor
            label={t("barcode")}
            value={barcode}
            onStage={(v) => onSave({ barcode: v })}
            onClose={close}
          />
        )}
      />

      {/* Shipment cost */}
      <ChipEditor
        icon={<Coins className="size-3.5" />}
        label={t("shipmentCost")}
        value={
          shipmentCostCents != null
            ? formatAmount(shipmentCostCents, locale)
            : null
        }
        disabled={disabled}
        render={({ close }) => (
          <CostEditor
            cents={shipmentCostCents}
            onStage={(cents) => onSave({ shipment_cost_cents: cents })}
            onClose={close}
          />
        )}
      />
    </div>
  )
}

function ChipEditor({
  icon,
  label,
  value,
  render,
  disabled,
}: {
  icon: ReactNode
  label: string
  value: string | null
  render: (api: { close: () => void }) => ReactNode
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasValue = value != null && value !== ""
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(p) => (
          <button
            {...p}
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors disabled:opacity-50",
              hasValue
                ? "bg-muted text-foreground ring-border"
                : "bg-muted/40 text-muted-foreground ring-transparent hover:bg-muted",
            )}
          >
            {hasValue ? (
              <span className="text-muted-foreground">{icon}</span>
            ) : (
              <PlusCircle className="size-3.5" />
            )}
            <span className="text-muted-foreground">{label}</span>
            {hasValue && (
              <span className="max-w-[160px] truncate font-semibold text-foreground">
                {value}
              </span>
            )}
          </button>
        )}
      />
      <PopoverContent align="start" className="w-72">
        {render({ close: () => setOpen(false) })}
      </PopoverContent>
    </Popover>
  )
}

function Footer({
  onCancel,
  onDone,
  doneDisabled = false,
}: {
  onCancel: () => void
  onDone: () => void
  doneDisabled?: boolean
}) {
  const t = useTranslations("transfers.chips")
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        {t("cancel")}
      </Button>
      <Button size="sm" onClick={onDone} disabled={doneDisabled}>
        {t("done")}
      </Button>
    </div>
  )
}

function TrackingEditor({
  number,
  url,
  onStage,
  onClose,
}: {
  number: string | null
  url: string | null
  onStage: (number: string | null, url: string | null) => void
  onClose: () => void
}) {
  const t = useTranslations("transfers.chips")
  // Values when the popover opened — restored if the user cancels.
  const [n0] = useState(number)
  const [u0] = useState(url)
  const [n, setN] = useState(number ?? "")
  const [u, setU] = useState(url ?? "")
  // Stage on every change so the contextual save bar reacts immediately.
  const stage = (nn: string, uu: string) =>
    onStage(nn.trim() || null, uu.trim() || null)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label>{t("trackingNumber")}</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {n.length}/255
          </span>
        </div>
        <Input
          autoFocus
          maxLength={255}
          value={n}
          onChange={(e) => {
            setN(e.target.value)
            stage(e.target.value, u)
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>{t("trackingUrl")}</Label>
        <Input
          value={u}
          onChange={(e) => {
            setU(e.target.value)
            stage(n, e.target.value)
          }}
        />
      </div>
      <Footer
        onCancel={() => {
          onStage(n0, u0)
          onClose()
        }}
        onDone={onClose}
      />
    </div>
  )
}

function SingleFieldEditor({
  label,
  placeholder,
  value,
  onStage,
  onClose,
}: {
  label: string
  placeholder?: string
  value: string | null
  onStage: (v: string | null) => void
  onClose: () => void
}) {
  const [original] = useState(value)
  const [v, setV] = useState(value ?? "")
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        <Input
          autoFocus
          placeholder={placeholder}
          value={v}
          onChange={(e) => {
            setV(e.target.value)
            onStage(e.target.value.trim() || null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onClose()
            }
          }}
        />
      </div>
      <Footer
        onCancel={() => {
          onStage(original)
          onClose()
        }}
        onDone={onClose}
      />
    </div>
  )
}

function ArrivalEditor({
  value,
  onStage,
  onClose,
}: {
  value: string | null
  onStage: (iso: string | null) => void
  onClose: () => void
}) {
  // Parse/stage the calendar date as a UTC calendar day so it round-trips
  // identically with the server regardless of the user's timezone.
  const selected = utcIsoToLocalDay(value)
  return (
    <Calendar
      mode="single"
      selected={selected}
      defaultMonth={selected}
      onSelect={(d?: Date) => {
        onStage(d ? localDayToUtcIso(d) : null)
        onClose()
      }}
      className="mx-auto"
    />
  )
}

function CostEditor({
  cents,
  onStage,
  onClose,
}: {
  cents: number | null
  onStage: (cents: number | null) => void
  onClose: () => void
}) {
  const t = useTranslations("transfers.chips")
  const [c0] = useState(cents)
  const [v, setV] = useState(cents != null ? (cents / 100).toString() : "")
  // Stage valid amounts live; ignore transient invalid input (e.g. "-", "1.").
  const stage = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === "") {
      onStage(null)
      return
    }
    const num = Number(trimmed)
    if (!Number.isFinite(num) || num < 0) return
    onStage(Math.round(num * 100))
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <Label>{t("amount")}</Label>
        <Input
          autoFocus
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={v}
          onChange={(e) => {
            setV(e.target.value)
            stage(e.target.value)
          }}
          placeholder="0.00"
          className="text-end tabular-nums"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onClose()
            }
          }}
        />
      </div>
      <Footer
        onCancel={() => {
          onStage(c0)
          onClose()
        }}
        onDone={onClose}
      />
    </div>
  )
}
