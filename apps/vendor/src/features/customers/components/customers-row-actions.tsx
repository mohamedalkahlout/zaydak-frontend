"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { CopyIcon, EllipsisIcon, PencilIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { Contact } from "@/features/customers/types"
import { sileo } from "sileo"
import { contactEmail } from "@/features/customers/lib/helpers"
import { DeleteCustomerDialog } from "./delete-customer-dialog"

export function CustomersRowActions({ contact }: { contact: Contact }) {
  const t = useTranslations("customers.rowActions")
  const tCommon = useTranslations("common")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const [deleteOpen, setDeleteOpen] = useState(false)
  const email = contactEmail(contact)

  /** `copiedTitle` is the whole toast, so no sentence is built from pieces. */
  const copyText = (copiedTitle: string, value: string) => {
    if (typeof navigator === "undefined") return
    navigator.clipboard.writeText(value).then(
      () => sileo.success({ title: copiedTitle }),
      () => sileo.error({ title: t("copyFailed") }),
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button
              {...p}
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("label")}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={
              <Link href={`/store/${shopSlug}/customers/${contact.id}`} />
            }
          >
            {tCommon("edit")}
            <PencilIcon className="ml-auto size-3.5 opacity-60" />
          </DropdownMenuItem>
          {email && (
            <DropdownMenuItem
              onClick={() => copyText(t("emailCopied"), email)}
            >
              {t("copyEmail")}
              <CopyIcon className="ml-auto size-3.5 opacity-60" />
            </DropdownMenuItem>
          )}
          {contact.phone_number && (
            <DropdownMenuItem
              onClick={() =>
                copyText(t("phoneCopied"), contact.phone_number as string)
              }
            >
              {t("copyPhone")}
              <CopyIcon className="ml-auto size-3.5 opacity-60" />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCustomerDialog
        contact={contact}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
