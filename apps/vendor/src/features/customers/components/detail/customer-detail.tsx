"use client"

import { useState } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { notFound, useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Trash2Icon } from "lucide-react"
import { sileo } from "sileo"
import { GET_CONTACT_BY_ID, GET_CONTACTS } from "@/features/customers/api"
import { DELETE_CONTACT } from "@/features/customers/api"
import { useMutation } from "@apollo/client/react"
import type {
  ContactResponse,
  DeleteContactResponse,
} from "@/features/customers/types"
import { CustomerForm } from "@/features/customers/components/form/customer-form"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { CustomerSummaryCard } from "./customer-summary-card"

interface CustomerDetailProps {
  id: string
}

/**
 * Composes the edit form with detail-page chrome:
 * - a Delete action in the header (with confirmation dialog)
 * - a summary card in the sidebar (added / updated / lead score)
 *
 * Edits flow through the form's own mutation hook; deletes go through
 * a local mutation here so the dialog can navigate back to the list.
 */
export function CustomerDetail({ id }: CustomerDetailProps) {
  const t = useTranslations("customers.delete")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data } = useSuspenseQuery<ContactResponse>(GET_CONTACT_BY_ID, {
    variables: { id },
  })
  const contact = data?.contact?.data
  if (!contact) {
    notFound()
  }

  const [deleteContact, { loading: deleting }] =
    useMutation<DeleteContactResponse>(DELETE_CONTACT, {
      refetchQueries: [
        { query: GET_CONTACTS, variables: { page: 1, limit: 50 } },
      ],
      awaitRefetchQueries: true,
    })

  const onDelete = async () => {
    try {
      const { data } = await deleteContact({ variables: { id: contact.id } })
      if (data?.deleteContact?.success) {
        sileo.success({
          title: t("deleted"),
          description: contact.name,
        })
        setDeleteOpen(false)
        router.push(`/store/${shopSlug}/customers`)
        return
      }
      sileo.error({
        title: t("failed"),
        description: data?.deleteContact?.message ?? undefined,
      })
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <>
      <CustomerForm
        mode="edit"
        contact={contact}
        headerAction={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon className="size-4" />
            {tCommon("delete")}
          </Button>
        }
        extraSidebar={<CustomerSummaryCard contact={contact} />}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t.rich("body", {
                name: contact.name,
                b: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? t("deleting") : tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
