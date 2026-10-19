"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation } from "@apollo/client/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { z } from "zod"
import { ChevronRight, Heart, LogOut, MapPin, Receipt } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"

import { clearAuthSession } from "@/shared/auth/session"
import { getValidationErrors } from "@/shared/auth/graphql-errors"
import { useAuthStore, type CurrentUser } from "@/shared/stores/auth"
import { useShop } from "@/features/shop/shop-context"
import { TelegramUpdatesCard } from "@/features/telegram/components/telegram-updates-card"
import { UPDATE_MY_PROFILE } from "../api"
import { useCurrentUser } from "../use-current-user"

/**
 * The account hub.
 *
 * Signing out lands back on the **shop home**, not on a login screen: the
 * customer is still shopping, and their cart survives the transition because it
 * falls back onto the anonymous `session_id` cookie the moment the token goes.
 *
 * The profile is read from the auth store, not fetched here. `ShopShell` has
 * already run the profile query once for the whole app (`useCurrentUserSync`),
 * so this page and the header greet the same customer at the same moment
 * instead of each arriving at the answer on its own schedule.
 */
export function AccountPage() {
  const t = useTranslations("account")
  const { slug, base: shopBase } = useShop()

  const { user: me, loading } = useCurrentUser()

  const base = `${shopBase}/account`

  return (
    <div className="shop-container py-10">
      <header className="mb-8">
        <h1 className="font-heading text-shop-title font-semibold tracking-tight">
          {t("title")}
        </h1>
        {loading ? (
          <div className="mt-2 h-5 w-40 animate-pulse rounded-full bg-muted" />
        ) : (
          me && (
            <p className="mt-1.5 text-shop-body text-muted-foreground">
              {me.name ? t("greeting", { name: me.name }) : t("greetingNoName")}
            </p>
          )
        )}
      </header>

      {/* Keyed by the customer, so a different sign-in seeds a fresh form. */}
      {me && <DetailsForm key={me.id} me={me} />}

      <ul className="mt-8 flex flex-col gap-3">
        <AccountLink
          href={`${base}/orders`}
          icon={<Receipt className="size-5" />}
          title={t("orders")}
          hint={t("ordersHint")}
        />
        <AccountLink
          href={`${shopBase}/wishlist`}
          icon={<Heart className="size-5" />}
          title={t("wishlist")}
          hint={t("wishlistHint")}
        />
        <AccountLink
          href={`${base}/addresses`}
          icon={<MapPin className="size-5" />}
          title={t("addresses")}
          hint={t("addressesHint")}
        />
      </ul>

      {/*
        Under the three destinations rather than among them: this is a setting,
        not a place to go, and it is the one thing on this page that changes
        where the shop can reach the customer. It renders nothing unless the
        shop has a connected bot.
      */}
      <div className="mt-6">
        <TelegramUpdatesCard />
      </div>

      <Button
        variant="outline"
        className="mt-8 rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
        onClick={async () => {
          await clearAuthSession(slug)
          sileo.success({ title: t("signedOut") })
          window.location.href = `${shopBase}/`
        }}
      >
        <LogOut />
        {t("signOut")}
      </Button>
    </div>
  )
}

const detailsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]),
})

type DetailsValues = z.infer<typeof detailsSchema>

/**
 * The customer's name and email — the only two things they edit about
 * themselves. The number is shown and not edited: it is how they sign in, so a
 * different number is a different customer. The email is for receipts and
 * updates only; clearing it is allowed.
 */
function DetailsForm({ me }: { me: CurrentUser }) {
  const t = useTranslations("account")
  const { slug } = useShop()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: me.name ?? "", email: me.email ?? "" },
  })

  const [updateProfile, { loading }] = useMutation(UPDATE_MY_PROFILE)

  async function onSubmit(values: DetailsValues) {
    setSaved(false)
    try {
      const result = await updateProfile({
        variables: {
          input: { name: values.name, email: values.email || null },
        },
      })
      const data = result.data?.updateMyCustomerProfile.data
      if (data) {
        useAuthStore.getState().setUser(slug, data as CurrentUser)
        reset({ name: data.name ?? "", email: data.email ?? "" })
      }
      setSaved(true)
      sileo.success({ title: t("saved") })
    } catch (error) {
      const fields = getValidationErrors(error).map((e) => e.field)
      if (fields.includes("name")) {
        setError("name", { type: "server", message: t("nameError") })
        return
      }
      if (fields.includes("email")) {
        setError("email", { type: "server", message: t("emailError") })
        return
      }
      sileo.error({ title: t("saveFailed") })
    }
  }

  return (
    <section className="shop-panel p-5">
      <h2 className="font-heading text-sm font-medium tracking-tight">
        {t("details")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("detailsHint")}</p>

      <form
        method="post"
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="account-phone" className="text-xs font-medium">
            {t("phone")}
          </Label>
          <Input
            id="account-phone"
            dir="ltr"
            readOnly
            value={me.phone_e164 ?? ""}
            className="h-11 rounded-xl border-shop-hairline bg-muted/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-name" className="text-xs font-medium">
            {t("name")}
          </Label>
          <Input
            id="account-name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            className="h-11 rounded-xl border-shop-hairline"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{t("nameError")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-email" className="text-xs font-medium">
            {t("email")}
          </Label>
          <Input
            id="account-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className="h-11 rounded-xl border-shop-hairline"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{t("emailError")}</p>
          )}
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <Button
            type="submit"
            className="rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            disabled={loading || !isDirty}
          >
            {loading ? t("saving") : t("save")}
          </Button>
          {saved && !isDirty && (
            <span className="text-xs text-muted-foreground">{t("saved")}</span>
          )}
        </div>
      </form>
    </section>
  )
}

function AccountLink({
  href,
  icon,
  title,
  hint,
}: {
  href: string
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="shop-panel flex items-center gap-4 p-5 transition-colors hover:bg-shop-accent-soft"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-sm font-medium tracking-tight">{title}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
        />
      </Link>
    </li>
  )
}
