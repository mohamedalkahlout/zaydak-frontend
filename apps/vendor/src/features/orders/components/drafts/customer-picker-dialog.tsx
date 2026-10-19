"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { BanIcon, PlusIcon, SearchIcon, UserIcon } from "lucide-react"
import { GET_CONTACTS } from "@/features/customers/api"
import { contactEmail, readMeta } from "@/features/customers/lib/helpers"
import type { Contact, ContactsResponse } from "@/features/customers/types"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  contactAddressToDraft,
  type DraftAddress,
} from "./draft-order-types"

/** A customer chosen from the picker → stages onto the draft. */
export interface PickedCustomer {
  /**
   * The contact's linked CUSTOMER id (`Contact.customer_id`), never the
   * contact's own id. `DraftOrder.customer_id` becomes the order's customer on
   * convert, and `orders.customer_id` is a foreign key to `customers`, so a
   * contact id failed every conversion. `null` when the contact is nobody's
   * customer: the draft is then a guest draft that still carries the name and
   * contact.
   */
  customer_id: string | null
  customer_name: string
  customer_contact: string | null
  address?: DraftAddress
}

interface CustomerPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (customer: PickedCustomer) => void
  onCreateNew: () => void
}

/** Shopify-style customer search modal over `contacts(search:)`. */
export function CustomerPickerDialog({
  open,
  onOpenChange,
  onSelect,
  onCreateNew,
}: CustomerPickerDialogProps) {
  const t = useTranslations("draftOrders.form")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSearch("")
      setDebounced("")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading } = useQuery<ContactsResponse>(GET_CONTACTS, {
    variables: {
      page: 1,
      limit: 50,
      ...(debounced ? { search: debounced } : {}),
    },
    skip: !open,
    fetchPolicy: "cache-and-network",
  })

  const contacts = useMemo<Contact[]>(
    () => data?.contacts?.data ?? [],
    [data],
  )

  const choose = (c: Contact) => {
    const meta = readMeta(c)
    onSelect({
      customer_id: c.customer_id ?? null,
      customer_name: c.name ?? "",
      customer_contact: c.phone_number ?? contactEmail(c),
      address: contactAddressToDraft(meta.default_address),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg grid-rows-[auto_auto_1fr_auto] h-[min(75vh,560px)] p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("selectCustomer")}</DialogTitle>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder={t("searchCustomerPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && contacts.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("noCustomersFound")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-start hover:bg-muted/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.name || t("unnamedCustomer")}
                      </span>
                      {c.phone_number ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.phone_number}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-5 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              onOpenChange(false)
              onCreateNew()
            }}
          >
            <PlusIcon className="size-4" />
            {t("createNewCustomer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
