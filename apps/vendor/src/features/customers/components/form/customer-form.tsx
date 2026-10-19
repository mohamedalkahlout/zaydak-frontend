"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  customerFormSchema,
  type CustomerFormInput,
  type CustomerFormOutput,
} from "@/features/customers/validations/customer"
import { contactToFormValues } from "@/features/customers/lib/helpers"
import type { Contact } from "@/features/customers/types"
import { CustomerFormLayout, type CustomerFormApi } from "./customer-form-layout"
import { useCustomerSubmit } from "./use-customer-submit"
import { OverviewCard } from "./cards/overview-card"
import { AddressCard } from "./cards/address-card"
import { TaxCard } from "./cards/tax-card"
import { NotesCard } from "./cards/notes-card"
import { TagsCard } from "./cards/tags-card"
import { StatusCard } from "./cards/status-card"

interface CustomerFormProps {
  mode?: "create" | "edit"
  contact?: Contact
  /** Slot rendered to the right of the title (e.g. Delete action on edit). */
  headerAction?: React.ReactNode
  /** Extra sidebar content rendered above the default Status/Notes/Tags cards. */
  extraSidebar?: React.ReactNode
}

const CREATE_DEFAULTS: CustomerFormInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  language: "en",
  accepts_marketing: false,
  accepts_sms_marketing: false,
  address: {
    address_1: "",
    address_2: "",
    city: "",
    region: "",
    country: "",
    postal_code: "",
    company: "",
  },
  tax_setting: "collect",
  tags: [],
  description: "",
  notes: "",
  status: "active",
}

/**
 * Entry point for the New / Edit customer pages. Picks the right
 * defaults, instantiates the form, and lays out the Shopify-style
 * two-column scaffold. Each card stays decoupled so we can re-order or
 * pull them into a future "detail page" inline-edit flow.
 */
export function CustomerForm({
  mode = "create",
  contact,
  headerAction,
  extraSidebar,
}: CustomerFormProps) {
  const t = useTranslations("customers.form")
  const tValidation = useTranslations("customers.validation")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  const defaults = useMemo<CustomerFormInput>(() => {
    if (mode === "edit" && contact) {
      return contactToFormValues(contact) as CustomerFormInput
    }
    return CREATE_DEFAULTS
  }, [mode, contact])

  const schema = useMemo(() => customerFormSchema(tValidation), [tValidation])
  const form = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const api = form as unknown as CustomerFormApi

  const { submit, onInvalid, loading } = useCustomerSubmit(
    mode === "edit" && contact
      ? { kind: "edit", contact, shopSlug }
      : { kind: "create", shopSlug },
  )

  const title =
    mode === "edit" ? contact?.name || t("editTitle") : t("newTitle")
  const subtitle = mode === "edit" ? undefined : t("newSubtitle")

  return (
    <CustomerFormLayout
      title={title}
      subtitle={subtitle}
      saving={loading}
      unsavedLabel={mode === "edit" ? t("unsavedEdit") : t("unsavedNew")}
      form={api}
      onValid={submit}
      onInvalid={onInvalid}
      headerAction={headerAction}
      sidebar={
        <>
          {extraSidebar}
          <StatusCard form={api} />
          <NotesCard form={api} />
          <TagsCard form={api} />
        </>
      }
    >
      <OverviewCard form={api} />
      <AddressCard form={api} initiallyOpen={mode === "edit"} />
      <TaxCard form={api} />
    </CustomerFormLayout>
  )
}
