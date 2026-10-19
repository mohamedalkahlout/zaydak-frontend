"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
import type { SubmitErrorHandler, SubmitHandler } from "react-hook-form"
import { sileo } from "sileo"
import {
  CREATE_CONTACT,
  GET_CONTACTS,
  UPDATE_CONTACT,
} from "@/features/customers/api"
import type {
  Contact,
  ContactMeta,
  CreateContactResponse,
  UpdateContactResponse,
} from "@/features/customers/types"
import { buildContactMutationInput } from "@/features/customers/lib/helpers"
import type {
  CustomerFormInput,
  CustomerFormOutput,
} from "@/features/customers/validations/customer"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"

type SubmitMode =
  | { kind: "create"; shopSlug: string }
  | { kind: "edit"; contact: Contact; shopSlug: string }

interface UseCustomerSubmitResult {
  submit: SubmitHandler<CustomerFormOutput>
  onInvalid: SubmitErrorHandler<CustomerFormInput>
  loading: boolean
}

/**
 * Wires the customer form to the Apollo mutations + Shopify-style
 * post-save behavior: create redirects to the detail page, edit stays
 * put but resets the form state so the unsaved bar disappears.
 */
export function useCustomerSubmit(mode: SubmitMode): UseCustomerSubmitResult {
  const t = useTranslations("customers.form")
  const router = useRouter()
  const setError = useUnsavedBarStore((s) => s.setError)

  const [createContact, { loading: creating }] =
    useMutation<CreateContactResponse>(CREATE_CONTACT, {
      refetchQueries: [
        { query: GET_CONTACTS, variables: { page: 1, limit: 50 } },
      ],
      awaitRefetchQueries: true,
    })

  const [updateContact, { loading: updating }] =
    useMutation<UpdateContactResponse>(UPDATE_CONTACT, {
      refetchQueries: [
        { query: GET_CONTACTS, variables: { page: 1, limit: 50 } },
      ],
      awaitRefetchQueries: true,
    })

  const submit = useCallback<SubmitHandler<CustomerFormOutput>>(
    async (values) => {
      setError(null)
      try {
        if (mode.kind === "create") {
          const input = buildContactMutationInput(values, null)
          const { data } = await createContact({ variables: { input } })
          const created = data?.createContact
          if (created?.success && created.data) {
            sileo.success({
              title: t("added"),
              description: created.data.name,
            })
            router.push(
              `/store/${mode.shopSlug}/customers/${created.data.id}`,
            )
            return
          }
          // The message reaches the merchant (toast and unsaved bar), so it is
          // copy rather than the name of the mutation that came back empty.
          throw new Error(t("tryAgain"))
        }

        const prevMeta = (mode.contact.meta ?? null) as ContactMeta | null
        const input = {
          id: mode.contact.id,
          ...buildContactMutationInput(values, prevMeta),
        }
        const { data } = await updateContact({ variables: { input } })
        const updated = data?.updateContact
        if (updated?.success && updated.data) {
          sileo.success({
            title: t("updated"),
            description: updated.data.name,
          })
          router.refresh()
          return
        }
        throw new Error(t("tryAgain"))
      } catch (err) {
        const message = err instanceof Error ? err.message : t("tryAgain")
        setError(message)
        sileo.error({
          title: mode.kind === "create" ? t("addFailed") : t("updateFailed"),
          description: message,
        })
      }
    },
    [mode, createContact, updateContact, router, setError, t],
  )

  const onInvalid = useCallback<SubmitErrorHandler<CustomerFormInput>>(
    (errors) => {
      const messages: string[] = []
      const visit = (val: unknown) => {
        if (!val || typeof val !== "object") return
        if (
          "message" in val &&
          typeof (val as { message?: unknown }).message === "string"
        ) {
          messages.push((val as { message: string }).message)
          return
        }
        for (const v of Object.values(val as Record<string, unknown>)) {
          visit(v)
        }
      }
      visit(errors)
      const first = messages.find(Boolean)
      if (first) setError(first)
    },
    [setError],
  )

  return { submit, onInvalid, loading: creating || updating }
}
