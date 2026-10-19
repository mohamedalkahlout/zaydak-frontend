"use client"

import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { DELETE_CONTACT } from "@/features/customers/api"
import { GET_CONTACTS } from "@/features/customers/api"
import type { Contact, DeleteContactResponse } from "@/features/customers/types"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

interface DeleteCustomerDialogProps {
  contact: Contact
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCustomerDialog({
  contact,
  open,
  onOpenChange,
}: DeleteCustomerDialogProps) {
  const t = useTranslations("customers.delete")
  const tCommon = useTranslations("common")
  const [deleteContact, { loading }] = useMutation<DeleteContactResponse>(
    DELETE_CONTACT,
    {
      refetchQueries: [
        { query: GET_CONTACTS, variables: { page: 1, limit: 50 } },
      ],
    },
  )

  const handleDelete = async () => {
    try {
      const { data } = await deleteContact({ variables: { id: contact.id } })
      if (data?.deleteContact?.success) {
        sileo.success({
          title: t("deleted"),
          description: contact.name,
        })
        onOpenChange(false)
      } else if (data?.deleteContact?.message) {
        sileo.error({
          title: t("failed"),
          description: data.deleteContact.message,
        })
      }
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("deleting") : tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
