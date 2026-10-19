"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Search, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import { LineItemCell } from "./transfer-helpers"

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n))

export type ReceiveLine = {
  id: string
  quantity: number
  received_quantity: number
  rejected_quantity: number
  product_id?: string | null
  variation_option_id?: string | null
  product_name?: Record<string, string> | string | null
  variant_title?: Record<string, string> | string | null
  image?: unknown
  sku?: string | null
}

export type ReceivePayloadLine = {
  line_id: string
  received_quantity: number
  rejected_quantity: number
}

const remainingOf = (l: ReceiveLine) =>
  l.quantity - l.received_quantity - l.rejected_quantity

/**
 * Shopify's "Receive items" modal. Per-line Accept / Reject inputs (incremental
 * this receipt) with live "Received X of Y" totals, plus Accept all / Reject
 * all shortcuts. Reject is the independent control; Accept is bounded by what's
 * left after Reject so a fresh receipt can still reject everything.
 *
 * The editable surface lives in `ReceiveBody`, mounted only while the dialog is
 * open — so the accept/reject draft is dropped on every close (user OR
 * programmatic-after-submit). Receipts are INCREMENTAL on the backend, so a
 * persisted draft would otherwise re-post abandoned/already-received units on
 * the next open.
 */
export function ReceiveItemsDialog({
  open,
  onOpenChange,
  destinationLabel,
  inTransitCount,
  lines,
  locale,
  receiving,
  onReceive,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  destinationLabel: string
  inTransitCount: number
  lines: ReceiveLine[]
  locale: string
  receiving: boolean
  onReceive: (payload: ReceivePayloadLine[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(n) => !receiving && onOpenChange(n)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-2xl"
      >
        {open && (
          <ReceiveBody
            destinationLabel={destinationLabel}
            inTransitCount={inTransitCount}
            lines={lines}
            locale={locale}
            receiving={receiving}
            onReceive={onReceive}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReceiveBody({
  destinationLabel,
  inTransitCount,
  lines,
  locale,
  receiving,
  onReceive,
  onClose,
}: {
  destinationLabel: string
  inTransitCount: number
  lines: ReceiveLine[]
  locale: string
  receiving: boolean
  onReceive: (payload: ReceivePayloadLine[]) => void
  onClose: () => void
}) {
  const t = useTranslations("transfers.receiveDialog")
  const tList = useTranslations("transfers.list")
  const [accept, setAccept] = useState<Record<string, number>>({})
  const [reject, setReject] = useState<Record<string, number>>({})
  const [query, setQuery] = useState("")

  const rejectVal = (l: ReceiveLine) =>
    clamp(reject[l.id] ?? 0, 0, remainingOf(l))
  const acceptVal = (l: ReceiveLine) =>
    clamp(accept[l.id] ?? 0, 0, remainingOf(l) - rejectVal(l))

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((l) => {
      const name =
        typeof l.product_name === "string"
          ? l.product_name
          : l.product_name
            ? Object.values(l.product_name).join(" ")
            : ""
      return (
        name.toLowerCase().includes(q) ||
        (l.sku ?? "").toLowerCase().includes(q)
      )
    })
  }, [lines, query])

  const acceptAll = () => {
    const a: Record<string, number> = {}
    for (const l of lines) a[l.id] = remainingOf(l)
    setAccept(a)
    setReject({})
  }
  const rejectAll = () => {
    const r: Record<string, number> = {}
    for (const l of lines) r[l.id] = remainingOf(l)
    setReject(r)
    setAccept({})
  }

  const submit = () => {
    const payload = lines
      .map((l) => ({
        line_id: l.id,
        received_quantity: acceptVal(l),
        rejected_quantity: rejectVal(l),
      }))
      .filter((p) => p.received_quantity > 0 || p.rejected_quantity > 0)
    onReceive(payload)
  }

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-border p-4">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {t("title", { location: destinationLabel })}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
            <span className="size-2 rounded-full ring-2 ring-sky-500 ring-inset" />
            {tList("inTransitN", { count: inTransitCount })}
          </span>
        </DialogTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("close")}
        </Button>
      </DialogHeader>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchProducts")}
              className="h-9 ps-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={acceptAll}>
              {t("acceptAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={rejectAll}>
              {t("rejectAll")}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">
                  {t("product")}
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {t("accept")}
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  {t("reject")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("received")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const rem = remainingOf(l)
                return (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5">
                      <LineItemCell line={l} locale={locale} compact />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        max={rem}
                        disabled={rem === 0}
                        value={acceptVal(l)}
                        onChange={(e) =>
                          setAccept((s) => ({
                            ...s,
                            [l.id]: clamp(
                              Number(e.target.value) || 0,
                              0,
                              rem - rejectVal(l),
                            ),
                          }))
                        }
                        className="mx-auto h-8 w-20 text-center tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        max={rem}
                        disabled={rem === 0}
                        value={rejectVal(l)}
                        onChange={(e) =>
                          setReject((s) => ({
                            ...s,
                            [l.id]: clamp(Number(e.target.value) || 0, 0, rem),
                          }))
                        }
                        className="mx-auto h-8 w-20 text-center tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">
                      <span
                        className={cn(rem === 0 && "font-medium text-emerald-600")}
                      >
                        {t("receivedOf", {
                          received: l.received_quantity,
                          total: l.quantity,
                        })}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border bg-muted/30 p-4">
        <Button variant="outline" onClick={onClose} disabled={receiving}>
          {t("close")}
        </Button>
        <Button onClick={submit} disabled={receiving}>
          {receiving && <Loader2 className="size-3.5 animate-spin" />}
          {t("receive")}
        </Button>
      </div>
    </>
  )
}
