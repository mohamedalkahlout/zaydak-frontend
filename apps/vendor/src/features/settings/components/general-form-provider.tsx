"use client"

import { createContext, useContext, useEffect } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { GET_MY_SHOPS, UPDATE_SHOP } from "@/features/shops/api"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { useSettingsShop } from "./settings-shell"
import { parseSettingsPath } from "../lib/routes"
import {
  brandDefaults,
  brandSettingsInput,
  socialsInput,
  toImageInput,
  type BrandKey,
} from "../lib/brand"
import type { GeneralValues, SettingsShop } from "../types"

export function buildDefaults(shop: SettingsShop): GeneralValues {
  const loc = shop.settings?.location
  return {
    name: shop.name ?? "",
    timezone: shop.timezone ?? "Asia/Riyadh",
    contact: shop.settings?.contact ?? "",
    email: shop.settings?.email ?? "",
    website: shop.settings?.website ?? "",
    formattedAddress: loc?.formattedAddress ?? "",
    apartment: loc?.apartment ?? "",
    company: loc?.company ?? "",
    city: loc?.city ?? "",
    state: loc?.state ?? "",
    district: loc?.district ?? "",
    zip: loc?.zip ?? "",
    country: loc?.country ?? "",
    ...brandDefaults(shop),
  }
}

/** The keys that make up `settings.contact` / `.email` / `.website` / `.location`. */
const CONTACT_KEYS: Array<keyof GeneralValues> = [
  "contact",
  "email",
  "website",
  "formattedAddress",
  "apartment",
  "company",
  "city",
  "state",
  "district",
  "zip",
  "country",
]

/** The keys the Brand sub-screen owns. */
const BRAND_KEYS: BrandKey[] = [
  "description",
  "slogan",
  "logo",
  "squareLogo",
  "coverImage",
  "primaryBackground",
  "primaryForeground",
  "secondaryBackground",
  "secondaryForeground",
  "socials",
]

/**
 * Value-based, so re-typing the original collapses the bar. Compares through
 * `JSON.stringify` because the brand keys (`logo`, `socials`) are objects that
 * `!==` would call different every render.
 */
function changed(
  values: GeneralValues,
  defaults: GeneralValues,
  keys: Array<keyof GeneralValues>,
) {
  return keys.some(
    (k) =>
      JSON.stringify(values[k] ?? null) !== JSON.stringify(defaults[k] ?? null),
  )
}

interface GeneralFormContextValue {
  shop: SettingsShop
  form: UseFormReturn<GeneralValues>
}

const GeneralFormContext = createContext<GeneralFormContextValue | null>(null)

/**
 * One form for General, Store contact details and Brand — held in the layout
 * they share, so it survives navigation between them.
 *
 * This is the whole reason those three are a nested route group rather than
 * three unrelated pages. They edit one `updateShop` call: a vendor who changes
 * the address, walks into Brand and swaps the logo has **one** set of unsaved
 * changes and one Save in the navbar. Splitting the form per route would put
 * two competing save bars in the same header and make "unsaved changes"
 * ambiguous — the thing `AGENTS.md` exists to prevent.
 *
 * Because the provider is the layout, leaving the group entirely (to Shipping,
 * say) unmounts it — and the edit with it. That is why the group arms
 * `useLeaveGuard` while dirty: an exit to another section, the overlay's X or
 * Escape, the header menu or a reload is held behind a confirm, while a move
 * *within* the group (General -> Brand -> Store contact details) stays silent,
 * because the form is still mounted on the other side of it. The bar still
 * tears itself down on unmount, so a confirmed exit leaves nothing hanging
 * over a pane with no fields to point at.
 */
export function GeneralFormProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const shop = useSettingsShop()
  const t = useTranslations("settings")
  const tG = useTranslations("settings.general")
  const apollo = useApolloClient()
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const form = useForm<GeneralValues>({
    defaultValues: shop ? buildDefaults(shop) : undefined,
    mode: "onTouched",
  })
  const { reset, handleSubmit, formState } = form
  const dirty = formState.isDirty

  const [update, { loading: saving }] = useMutation(UPDATE_SHOP, {
    onCompleted: () => {
      sileo.success({ title: tG("saved") })
      void apollo.refetchQueries({ include: [GET_MY_SHOPS] })
    },
    onError: (err) => {
      sileo.error({ title: err.message })
      setBarError(err.message)
    },
  })

  // Re-sync to the server after a save+refetch (or any external change), keyed
  // on a signature of just the editable fields — which is exactly what
  // `buildDefaults` returns — so unrelated refetches don't wipe an edit in
  // progress. Value-based, like the transfers detail page.
  const serverSig = shop ? JSON.stringify(buildDefaults(shop)) : ""
  useEffect(() => {
    if (shop) reset(buildDefaults(shop))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig])

  /**
   * Save = one `updateShop` carrying only the groups that moved.
   *
   * `settings` is sent as a partial patch — just `brand`, or just the contact
   * and location half — because `ShopsService.update` merges it key by key.
   * Before that merge existed this had to resend every key it was not editing,
   * `isShopUnderMaintenance` included, or the write would erase them.
   *
   * `handleSubmit` hands us the live values, so the bar closes over the latest
   * edit rather than over whatever was staged when it was registered.
   */
  const onSave = handleSubmit((values) => {
    if (!shop) return
    setBarError(null)
    const def = buildDefaults(shop)
    const input: Record<string, unknown> = {}
    const settings: Record<string, unknown> = {}

    if (values.name.trim() !== def.name) input.name = values.name.trim()
    if (values.timezone.trim() !== def.timezone) input.timezone = values.timezone.trim()

    if (changed(values, def, CONTACT_KEYS)) {
      settings.contact = values.contact.trim() || null
      settings.email = values.email.trim() || null
      settings.website = values.website.trim() || null
      settings.location = {
        formattedAddress: values.formattedAddress.trim() || null,
        apartment: values.apartment.trim() || null,
        company: values.company.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim() || null,
        district: values.district.trim() || null,
        zip: values.zip.trim() || null,
        country: values.country.trim() || null,
        lat: shop.settings?.location?.lat ?? null,
        lng: shop.settings?.location?.lng ?? null,
      }
    }

    if (changed(values, def, BRAND_KEYS)) {
      // The default logo, the cover image and the short description are real
      // columns; only the slogan, the square logo and the colours are settings.
      if (JSON.stringify(values.logo) !== JSON.stringify(def.logo)) {
        input.logo = toImageInput(values.logo)
      }
      if (JSON.stringify(values.coverImage) !== JSON.stringify(def.coverImage)) {
        input.cover_image = toImageInput(values.coverImage)
      }
      if (values.description !== def.description) {
        input.description = values.description.trim() || null
      }
      if (JSON.stringify(values.socials) !== JSON.stringify(def.socials)) {
        input.socials = socialsInput(values, shop)
      }
      settings.brand = brandSettingsInput(values)
    }

    if (Object.keys(settings).length > 0) input.settings = settings
    if (Object.keys(input).length === 0) return
    void update({ variables: { slug: shop.slug, input } })
  },
    (errors) => {
      const firstError =
        errors.email?.message ||
        errors.contact?.message ||
        errors.name?.message ||
        t("fixTheForm")
      sileo.error({ title: String(firstError) })
      setBarError(String(firstError))
    }
  )

  const onDiscard = () => {
    reset()
    setBarError(null)
  }

  // Drive the global navbar save bar while dirty; tear it down on unmount.
  useEffect(() => {
    if (!dirty) {
      hideBar()
      return
    }
    showBar({ label: t("unsavedChanges"), saving, onSave, onDiscard })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving])
  useEffect(() => () => hideBar(), [hideBar])

  // Hold the vendor while dirty. `allow` keeps every in-group URL silent — the
  // rail's General entry, the contact and Brand rows, the breadcrumb back —
  // because the form survives all of those. `when` is `dirty` alone rather
  // than `dirty && !saving`, so a click during an in-flight save still asks;
  // a successful save resets the form, and that is what disarms it.
  useLeaveGuard({
    when: dirty,
    allow: (path) => parseSettingsPath(path).section === "general",
    onLeave: () => {
      reset()
      setBarError(null)
      hideBar()
    },
  })

  if (!shop) return null

  return (
    <GeneralFormContext.Provider value={{ shop, form }}>
      {children}
    </GeneralFormContext.Provider>
  )
}

/** Throws outside the General route group — a pane there is a bug, not a state. */
export function useGeneralForm(): GeneralFormContextValue {
  const ctx = useContext(GeneralFormContext)
  if (!ctx) {
    throw new Error("useGeneralForm must be used inside GeneralFormProvider")
  }
  return ctx
}
