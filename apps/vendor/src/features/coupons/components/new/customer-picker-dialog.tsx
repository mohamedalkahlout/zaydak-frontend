"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { BanIcon, SearchIcon, UserIcon } from "lucide-react"
import { GET_SHOP_CUSTOMERS_FOR_COUPON } from "@/features/coupons/api"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"

/** One of the shop's customers (`customers.id`). */
interface CustomerRow {
  id: string
  name?: string | null
  phone_e164?: string | null
  email?: string | null
}

interface ShopCustomersForCouponResponse {
  shopCustomers: {
    success: boolean
    data: CustomerRow[] | null
  }
}

/** A customer who never gave a name is known by the number they proved. */
function customerLabel(r: CustomerRow): string {
  return r.name || r.phone_e164 || r.email || r.id
}

/** A value that lags its input until it stops changing. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

interface CustomerPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (ids: string[], snapshots: Record<string, { name: string }>) => void
  maxSelection?: number
}

/**
 * Multi-select picker for `SPECIFIC_CUSTOMERS` coupons, over the shop's own
 * customers (`shopCustomers`). The search is the server's — name or email as
 * typed, a number by its digits — debounced so a merchant typing does not
 * fire one query per character.
 */
export function CustomerPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  maxSelection = 100,
}: CustomerPickerDialogProps) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
  }

  const query = useDebounced(search.trim(), 250)
  const { data, loading } = useQuery<ShopCustomersForCouponResponse>(
    GET_SHOP_CUSTOMERS_FOR_COUPON,
    {
      variables: { search: query || undefined, page: 1, limit: 100 },
      skip: !open,
      fetchPolicy: "cache-and-network",
    },
  )

  const rows = useMemo<CustomerRow[]>(
    () => data?.shopCustomers?.data ?? [],
    [data],
  )
  const visible = rows

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelection) {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const snapshots: Record<string, { name: string }> = {}
    for (const r of rows) {
      if (selected.has(r.id)) {
        snapshots[r.id] = { name: customerLabel(r) }
      }
    }
    onConfirm(Array.from(selected), snapshots)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelected(new Set(value))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("customerPicker.title")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("customerPicker.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && visible.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("customerPicker.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((r) => {
                const checked = selected.has(r.id)
                const label = customerLabel(r)
                // The second line says what the first does not.
                const detail =
                  label === r.phone_e164 ? r.email : r.phone_e164 || r.email
                return (
                  <li key={r.id}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(r.id)}
                      />
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        {detail && detail !== label && (
                          <p
                            dir="ltr"
                            className="truncate text-xs text-muted-foreground"
                          >
                            {detail}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {t("customerPicker.selected", {
              selected: selected.size,
              max: maxSelection,
            })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {t("pickers.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
