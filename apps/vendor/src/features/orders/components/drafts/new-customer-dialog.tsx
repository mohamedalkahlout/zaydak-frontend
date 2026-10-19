"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { PencilIcon, UserIcon, XIcon } from "lucide-react"
import { CREATE_CONTACT } from "@/features/customers/api"
import {
  buildContactMutationInput,
  composeName,
} from "@/features/customers/lib/helpers"
import type { CreateContactResponse } from "@/features/customers/types"
import { customerLanguageOptions } from "@/features/customers/lib/constants"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@repo/ui/components/drawer"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Textarea } from "@repo/ui/components/textarea"
import type { DraftAddress } from "./draft-order-types"
import type { PickedCustomer } from "./customer-picker-dialog"

interface NewCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: PickedCustomer & { address: DraftAddress }) => void
}

const emptyAddress = (): DraftAddress => ({
  street_address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
})

/**
 * "New customer" surface for draft orders. Same presentation shell as analytics
 * `TargetCreateDialog`: a bottom drawer (slides up, swipe handle) with a header
 * of Close + Save and a two-column body. Persists via `createContact`; address
 * is also returned so the draft can price shipping.
 */
export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: NewCustomerDialogProps) {
  const t = useTranslations("draftOrders.form")
  const tCustomers = useTranslations("customers")
  // Both selects hand their options to the root as `items`: without them Base
  // UI's SelectValue prints the raw value ("en", "collect") in the trigger.
  // The languages are the customer form's own list, named the same way there.
  const languageOptions = customerLanguageOptions(tCustomers)
  const taxOptions = [
    { value: "collect", label: t("taxCollect") },
    { value: "dont_collect", label: t("taxDontCollect") },
    { value: "exempt", label: t("taxExempt") },
  ]
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [language, setLanguage] = useState("en")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [acceptsEmail, setAcceptsEmail] = useState(false)
  const [acceptsSms, setAcceptsSms] = useState(false)
  const [notes, setNotes] = useState("")
  const [editingNotes, setEditingNotes] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [showAddress, setShowAddress] = useState(false)
  const [address, setAddress] = useState<DraftAddress>(emptyAddress)
  const [taxSetting, setTaxSetting] = useState<"collect" | "dont_collect" | "exempt">(
    "collect",
  )
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setFirstName("")
      setLastName("")
      setLanguage("en")
      setEmail("")
      setPhone("")
      setAcceptsEmail(false)
      setAcceptsSms(false)
      setNotes("")
      setEditingNotes(false)
      setTags([])
      setTagInput("")
      setShowAddress(false)
      setAddress(emptyAddress())
      setTaxSetting("collect")
    }
  }

  // Drop every cached `contacts(...)` list rather than refetch one: the
  // picker (limit 50), the @mention search (limit 100) and the customers
  // table each cache their own argument set, and a refetch by variables
  // refreshes only the one it names. The next reader of any of them fetches.
  const [create, { loading }] = useMutation<CreateContactResponse>(
    CREATE_CONTACT,
    {
      update(cache) {
        cache.evict({ id: "ROOT_QUERY", fieldName: "contacts" })
        cache.gc()
      },
    },
  )

  const canSave =
    firstName.trim() || lastName.trim() || email.trim() || phone.trim()

  function addTag() {
    const next = tagInput.trim()
    if (!next || tags.includes(next)) {
      setTagInput("")
      return
    }
    setTags((prev) => [...prev, next])
    setTagInput("")
  }

  async function save() {
    if (!canSave) return
    const input = buildContactMutationInput({
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone,
      language,
      accepts_marketing: acceptsEmail,
      accepts_sms_marketing: acceptsSms,
      address: {
        address_1: address.street_address,
        city: address.city,
        region: address.state,
        postal_code: address.zip,
        country: address.country,
      },
      tax_setting: taxSetting,
      tags,
      notes,
      description: "",
      status: "active",
    })
    try {
      const { data } = await create({ variables: { input } })
      const created = data?.createContact?.data
      if (!created) throw new Error("createContact did not return data")
      onCreated({
        // The shop's customer createContact linked by the number they
        // proved, or null (guest draft) — a merchant typing a number does not
        // make somebody a customer. Never `created.id`: that is a contact id,
        // not a customers.id.
        customer_id: created.customer_id ?? null,
        customer_name:
          composeName(firstName, lastName) ||
          created.name ||
          email.trim() ||
          phone.trim(),
        customer_contact: phone.trim() || email.trim() || null,
        address,
      })
      sileo.success({ title: t("customerCreated") })
      onOpenChange(false)
    } catch (err) {
      sileo.error({
        title: err instanceof Error ? err.message : t("customerCreateFailed"),
      })
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-4xl max-h-[calc(100dvh-1.5rem)]">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <UserIcon className="size-4 text-muted-foreground" />
              {t("newCustomerTitle")}
            </DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                {t("close")}
              </Button>
              <Button
                type="button"
                disabled={!canSave || loading}
                onClick={() => void save()}
              >
                {loading ? t("saving") : t("saveCustomer")}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 lg:grid-cols-[1fr_16rem]">
            <div className="flex flex-col gap-4">
              <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h3 className="mb-4 text-sm font-medium">{t("customerOverview")}</h3>
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>{t("firstName")}</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>{t("lastName")}</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("language")}</Label>
                    <Select
                      items={languageOptions}
                      value={language}
                      onValueChange={(v) => {
                        if (v) setLanguage(v)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("languageHint")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("email")}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("phone")}</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={acceptsEmail}
                      onCheckedChange={(v) => setAcceptsEmail(v === true)}
                    />
                    {t("acceptsEmailMarketing")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={acceptsSms}
                      onCheckedChange={(v) => setAcceptsSms(v === true)}
                    />
                    {t("acceptsSmsMarketing")}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t("marketingConsentHint")}
                  </p>
                </div>
              </section>

              <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h3 className="text-sm font-medium">{t("defaultAddress")}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("defaultAddressHint")}
                </p>
                {!showAddress ? (
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted/40"
                    onClick={() => setShowAddress(true)}
                  >
                    <span>+ {t("addAddress")}</span>
                    <span className="text-muted-foreground">›</span>
                  </button>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    <Input
                      placeholder={t("street")}
                      value={address.street_address}
                      onChange={(e) =>
                        setAddress((a) => ({
                          ...a,
                          street_address: e.target.value,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder={t("city")}
                        value={address.city}
                        onChange={(e) =>
                          setAddress((a) => ({ ...a, city: e.target.value }))
                        }
                      />
                      <Input
                        placeholder={t("state")}
                        value={address.state}
                        onChange={(e) =>
                          setAddress((a) => ({ ...a, state: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder={t("zip")}
                        value={address.zip}
                        onChange={(e) =>
                          setAddress((a) => ({ ...a, zip: e.target.value }))
                        }
                      />
                      <Input
                        placeholder={t("country")}
                        value={address.country}
                        onChange={(e) =>
                          setAddress((a) => ({ ...a, country: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h3 className="mb-3 text-sm font-medium">{t("taxDetails")}</h3>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("taxSettings")}</Label>
                  <Select
                    items={taxOptions}
                    value={taxSetting}
                    onValueChange={(v) => {
                      if (
                        v === "collect" ||
                        v === "dont_collect" ||
                        v === "exempt"
                      ) {
                        setTaxSetting(v)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-4">
              <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">{t("notes")}</h3>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("editNotes")}
                    onClick={() => setEditingNotes((v) => !v)}
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                </div>
                {editingNotes ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {notes.trim() || t("notesPrivateHint")}
                  </p>
                )}
              </section>

              <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h3 className="mb-2 text-sm font-medium">{t("tags")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={t("removeTag")}
                        onClick={() =>
                          setTags((prev) => prev.filter((x) => x !== tag))
                        }
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  className="mt-2"
                  placeholder={t("addTags")}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  onBlur={addTag}
                />
              </section>
            </aside>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
