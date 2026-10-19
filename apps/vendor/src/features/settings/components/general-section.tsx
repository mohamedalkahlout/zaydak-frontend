"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import {
  Building2,
  ChevronRight,
  Headset,
  MapPin,
  MoreHorizontal,
  Tag,
  Sparkles,
  ChevronDown,
} from "lucide-react"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group"
import { Controller } from "react-hook-form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { SA_REGIONS, geoLabel, resolveCountry } from "@/shared/geo"
import { cn } from "@/shared/lib/utils"
import { SettingsCard } from "./settings-card"
import { StoreAddressDialog } from "./store-address-dialog"
import { DeleteShopDialog } from "./delete-shop-dialog"
import { useGeneralForm } from "./general-form-provider"
import { generalSubviewUrl } from "../lib/routes"
import { TIMEZONE_OPTIONS, getTimezoneLabel } from "../lib/timezones"

/**
 * The General pane at `/settings/general`.
 *
 * It owns no form. The `useForm` lives in the route group's layout
 * (`GeneralFormProvider`) so that this pane, Store contact details and Brand —
 * three URLs — stage into one patch and raise one save bar. What is left here
 * is the pane itself: summary rows that link to the other two, the address
 * dialog, and the cards that are still display-only.
 */
export function GeneralSection() {
  const { shop, form } = useGeneralForm()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const tG = useTranslations("settings.general")
  const locale = useLocale()
  const fv = form.watch()
  const [addressOpen, setAddressOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const tDelete = useTranslations("settings.general.deleteStore")
  // The store's own address if it has one, else the owner's account address —
  // the row is showing "how this shop is reached", and the account email is
  // only the fallback for that, not the answer.
  const contactSubtitle = [
    fv.email || shop.owner?.email || tG("noEmail"),
    fv.contact || tG("noPhone"),
  ]
    .filter(Boolean)
    .join(" · ")

  /**
   * Country and region are localized off the bundled tables; the city and the
   * street line are shown exactly as stored. Localizing the city too would mean
   * pulling the ~1MB Saudi city chunk in just to draw a one-line summary, and
   * the stored English name is readable either way.
   */
  const country = resolveCountry(fv.country)
  const countryLabel = country ? geoLabel(country, locale) : fv.country
  const region = SA_REGIONS.find((r) => r.en === fv.state)
  const addressSubtitle =
    [
      fv.company,
      fv.formattedAddress,
      fv.apartment,
      fv.district,
      fv.city,
      region ? geoLabel(region, locale) : fv.state,
      fv.zip,
      countryLabel,
    ]
      .filter(Boolean)
      .join(" · ") || tG("noAddress")

  return (
    <div className="flex flex-col gap-5">
      {/* Business details ────────────────────────────────────────────────── */}
      <SettingsCard title={tG("businessDetails")} description={tG("businessDetailsDesc")}>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {tG("entityName", { name: shop.name })}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {countryLabel || tG("notSet")}
            </p>
          </div>
          <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </SettingsCard>

      {/* Store contact details ───────────────────────────────────────────── */}
      {/*
        Two rows, each opening its own editor rather than expanding in place:
        the contact details are a sub-pane (they include the store name, which
        wants room), the address is a dialog (Shopify's split, and the country
        switch behind it changes which fields are even rendered). Both stage
        into this pane's form — neither one saves.
      */}
      <SettingsCard title={tG("contactDetails")}>
        <div className="-mx-1 flex flex-col">
          <StaticRow
            icon={<Headset className="size-4" />}
            title={shop.name}
            subtitle={contactSubtitle}
            href={generalSubviewUrl(shopSlug, "contact")}
          />
          <div className="mx-1 border-t border-border" />
          <StaticRow
            icon={<MapPin className="size-4" />}
            title={tG("storeAddress")}
            subtitle={addressSubtitle}
            onClick={() => setAddressOpen(true)}
          />
        </div>
      </SettingsCard>

      <StoreAddressDialog
        form={form}
        open={addressOpen}
        onOpenChange={setAddressOpen}
      />

      {/* Store defaults (display-only) ───────────────────────────────────── */}
      <SettingsCard title={tG("storeDefaults")}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{tG("currencyDisplay")}</p>
              <p className="text-xs text-muted-foreground">
                {tG("currencyDisplayDesc")}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {tG("currencyValue")}
              <MoreHorizontal className="size-3.5" />
            </span>
          </div>
          <ReadonlyField label={tG("backupRegion")} hint={tG("backupRegionDesc")}>
            {countryLabel || tG("notSet")}
          </ReadonlyField>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadonlyField label={tG("unitSystem")}>
              {tG("metricSystem")}
            </ReadonlyField>
            <ReadonlyField label={tG("weightUnit")}>
              {tG("kilogram")}
            </ReadonlyField>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{tG("timeZone")}</label>
            <Controller
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <Select
                  value={field.value || "Asia/Riyadh"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue>
                      {getTimezoneLabel(field.value || "Asia/Riyadh", locale)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIMEZONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {locale === "ar" ? opt.labelAr : opt.labelEn}
                      </SelectItem>
                    ))}
                    {!TIMEZONE_OPTIONS.some((o) => o.value === field.value) && field.value && (
                      <SelectItem value={field.value}>
                        {field.value}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{tG("timeZoneDesc")}</p>
          </div>
        </div>
      </SettingsCard>

      {/* Order ID format (display-only) ──────────────────────────────────── */}
      <SettingsCard title={tG("orderIdFormat")} description={tG("orderIdFormatDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label={tG("prefix")}>
            <Input value="#" disabled readOnly />
          </LabeledInput>
          <LabeledInput label={tG("suffix")}>
            <Input value="" disabled readOnly placeholder="" />
          </LabeledInput>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {tG("orderIdHint")}
        </p>
      </SettingsCard>

      {/* Order processing (display-only) ─────────────────────────────────── */}
      <SettingsCard title={tG("orderProcessing")}>
        <p className="mb-2 text-sm font-medium">{tG("afterPaid")}</p>
        <RadioGroup defaultValue="none" className="gap-2.5">
          {(["fulfillAll", "fulfillGiftCards", "none"] as const).map((opt) => (
            <label
              key={opt}
              className="flex cursor-default items-center gap-2.5 text-sm"
            >
              <RadioGroupItem value={opt} disabled />
              {tG(opt)}
            </label>
          ))}
        </RadioGroup>
        <p className="mt-4 mb-2 text-sm font-medium">{tG("afterFulfilled")}</p>
        <label className="flex cursor-default items-start gap-2.5 text-sm">
          <Checkbox defaultChecked disabled className="mt-0.5" />
          <span>
            {tG("autoArchive")}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {tG("autoArchiveDesc")}
            </span>
          </span>
        </label>
      </SettingsCard>

      {/* Store assets (display-only) ─────────────────────────────────────── */}
      <SettingsCard title={tG("storeAssets")}>
        <div className="-mx-1 flex flex-col">
          <StaticRow icon={<Tag className="size-4" />} title={tG("metafields")} subtitle={tG("metafieldsDesc")} />
          <div className="mx-1 border-t border-border" />
          <StaticRow
            icon={<Sparkles className="size-4" />}
            title={tG("brand")}
            subtitle={tG("brandDesc")}
            href={generalSubviewUrl(shopSlug, "brand")}
          />
        </div>
      </SettingsCard>

      {/* Resources (display-only) ────────────────────────────────────────── */}
      <SettingsCard title={tG("resources")}>
        <div className="flex flex-col gap-2.5">
          <ResourceRow label={tG("changeLog")} action={tG("viewChangeLog")} />
          <ResourceRow label={tG("helpCenter")} action={tG("getHelp")} />
          <ResourceRow label={tG("hirePartner")} action={tG("hirePartnerAction")} />
        </div>
        <div className="-mx-1 mt-3 flex flex-col border-t border-border pt-1">
          <StaticRow title={tG("keyboardShortcuts")} />
          <div className="mx-1 border-t border-border" />
          <StaticRow title={tG("storeActivityLog")} />
        </div>
      </SettingsCard>

      {/* Transfer store (display-only) ───────────────────────────────────── */}
      <SettingsCard title={tG("transferStore")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{tG("transferStoreDesc")}</p>
          <Button variant="outline" size="sm" disabled className="shrink-0">
            {tG("manage")}
          </Button>
        </div>
      </SettingsCard>

      {/* Soft-delete the current shop. Confirm dialog names it and explains
          that platform staff can restore; there is no vendor hard-delete. */}
      <SettingsCard
        title={tDelete("title")}
        description={tDelete("cardDesc")}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{tDelete("cardBody")}</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setDeleteOpen(true)}
          >
            {tDelete("action")}
          </Button>
        </div>
      </SettingsCard>

      <DeleteShopDialog
        shop={{ name: shop.name, slug: shop.slug }}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────
// `SettingsCard` is shared with the Plan pane — see `./settings-card`.

/**
 * The chevron row every card in this pane is built from.
 *
 * `href` makes it a link to another settings URL, `onClick` a button that opens
 * something in place (the address dialog), and neither leaves the flat row the
 * not-yet-built cards use — which is why the chevron is drawn either way.
 */
function StaticRow({
  icon,
  title,
  subtitle,
  href,
  onClick,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  href?: string
  onClick?: () => void
}) {
  const body = (
    <>
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
    </>
  )

  const interactive =
    "flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-start transition-colors hover:bg-muted/50"

  if (href) {
    return (
      <Link href={href} className={interactive}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactive}>
        {body}
      </button>
    )
  }
  return <div className="flex items-center gap-3 px-1 py-2.5">{body}</div>
}

function ResourceRow({ label, action }: { label: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Button variant="outline" size="sm" disabled className="shrink-0">
        {action}
      </Button>
    </div>
  )
}

function LabeledInput({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

function ReadonlyField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex h-9 items-center justify-between rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
        <span className="truncate">{children}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
