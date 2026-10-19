"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  useApolloClient,
  useMutation,
  useSuspenseQuery,
} from "@apollo/client/react"
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  Building,
} from "lucide-react"
import { sileo } from "sileo"
import {
  GET_SUPPLIERS,
  CREATE_SUPPLIER,
  UPDATE_SUPPLIER,
  DELETE_SUPPLIER,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Card, CardContent } from "@repo/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/components/dialog"
import { EmptyState, EmptyStateInline } from "@/shared/components/empty-state"
import { SuppliersIllustration } from "@/features/inventory/components/empty-illustrations"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"

type Supplier = {
  id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  address_line1?: string | null
  city?: string | null
  country?: string | null
  note?: string | null
}

type SuppliersResp = {
  suppliers: { success: boolean; data: Supplier[]; meta: { total: number } }
}

/**
 * Supplier rolodex. Pure CRUD over a shop-scoped list — the PO flow picks
 * from this list when the vendor creates a purchase order, so this page is
 * effectively the "Inventory → Suppliers" subview.
 */
export function SuppliersPage() {
  const t = useTranslations("inventory.suppliers")
  const tInv = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const apollo = useApolloClient()

  const { data } = useSuspenseQuery<SuppliersResp>(GET_SUPPLIERS)
  const suppliers = data?.suppliers?.data ?? []

  const [search, setSearch] = useState("")
  const filtered = search.trim()
    ? suppliers.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      )
    : suppliers
  const isPristineEmpty = suppliers.length === 0 && !search.trim()

  const [editing, setEditing] = useState<Supplier | null>(null)
  const [creating, setCreating] = useState(false)

  const [del, { loading: deleting }] = useMutation(DELETE_SUPPLIER, {
    onCompleted: () => {
      sileo.success({ title: t("deleted") })
      void apollo.refetchQueries({ include: [GET_SUPPLIERS] })
    },
    onError: (err) => sileo.error({ title: err.message }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {shopSlug && (
              <Link
                href={`/store/${shopSlug}/products/inventory`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                {tInv("title")}
              </Link>
            )}
          </div>
          <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {isPristineEmpty ? (
        <EmptyState
          illustration={<SuppliersIllustration className="size-40" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          }
        />
      ) : (
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <DataTableToolbar
          search={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder={t("search")}
            />
          }
        />
        <div>
          {filtered.length === 0 && (
            <EmptyStateInline
              title={t("noMatching")}
              description={t("noMatchingBody")}
            />
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border-b border-border/60 px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <Building className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[s.contact_name, s.email, s.phone, s.city, s.country]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(s)}
                >
                  <Pencil className="size-3.5" />
                  {tCommon("edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={deleting}
                  aria-label={tCommon("delete")}
                  onClick={() => {
                    if (window.confirm(t("confirmDelete", { name: s.name }))) {
                      void del({ variables: { id: s.id } })
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      <SupplierFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        supplier={null}
      />
      {editing && (
        <SupplierFormDialog
          open
          onClose={() => setEditing(null)}
          supplier={editing}
        />
      )}
    </div>
  )
}

function SupplierFormDialog({
  open,
  onClose,
  supplier,
}: {
  open: boolean
  onClose: () => void
  supplier: Supplier | null
}) {
  const t = useTranslations("inventory.suppliers")
  const tCommon = useTranslations("common")
  const apollo = useApolloClient()
  const isEdit = !!supplier
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contact_name: supplier?.contact_name ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address_line1: supplier?.address_line1 ?? "",
    city: supplier?.city ?? "",
    country: supplier?.country ?? "",
    note: supplier?.note ?? "",
  })

  const [create, { loading: creating }] = useMutation(CREATE_SUPPLIER, {
    onCompleted: () => {
      sileo.success({ title: t("created") })
      void apollo.refetchQueries({ include: [GET_SUPPLIERS] })
      onClose()
    },
    onError: (err) => sileo.error({ title: err.message }),
  })
  const [update, { loading: updating }] = useMutation(UPDATE_SUPPLIER, {
    onCompleted: () => {
      sileo.success({ title: t("updated") })
      void apollo.refetchQueries({ include: [GET_SUPPLIERS] })
      onClose()
    },
    onError: (err) => sileo.error({ title: err.message }),
  })

  function submit() {
    if (!form.name.trim()) {
      sileo.error({ title: t("nameRequired") })
      return
    }
    const input = {
      name: form.name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address_line1: form.address_line1 || null,
      city: form.city || null,
      country: form.country || null,
      note: form.note || null,
    }
    if (isEdit) {
      void update({
        variables: { input: { id: supplier!.id, ...input } },
      })
    } else {
      void create({ variables: { input } })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("add")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("name")}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("contactName")}</Label>
            <Input
              value={form.contact_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, contact_name: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("email")}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("phone")}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("address")}</Label>
            <Input
              value={form.address_line1}
              onChange={(e) =>
                setForm((s) => ({ ...s, address_line1: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("city")}</Label>
            <Input
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("country")}</Label>
            <Input
              maxLength={2}
              placeholder={t("countryPlaceholder")}
              value={form.country}
              onChange={(e) =>
                setForm((s) => ({ ...s, country: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("note")}</Label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={creating || updating}>
            {(creating || updating) && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {isEdit ? tCommon("save") : t("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
