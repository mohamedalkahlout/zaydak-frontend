"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"

import { COMPLETE_VENDOR_SIGNUP } from "../../api"
import type {
  CompleteVendorSignupResponse,
  SignupDraftData,
} from "../../types"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import { useAuthStore } from "@/shared/stores/auth"
import { regionName } from "@/shared/lib/country-name"
import { ENABLED_COUNTRY_PROFILES } from "@/features/shops/api"
import { mintTemporaryHandle } from "@/features/shops/lib/temporary-store"
import { type StoreType } from "@/features/shops/lib/store-types"
import { StoreFrame } from "@/features/shops/components/store-frame"
import { StoreTypePicker } from "@/features/shops/components/store-type-picker"

type EnabledProfile = {
  country_code: string
  default_currency: string
}

/**
 * The last pane of `/register`. Same flow as `/create-store`: declared
 * business country (enabled CountryProfiles only), then type chips.
 * Soft-preselect from the phone dial country when that market is enabled.
 */
export function StoreStep({
  draft,
  phoneCountryCode,
  onSessionLost,
  onBack,
}: {
  draft: SignupDraftData
  /** Soft preselect only — never written without merchant confirmation. */
  phoneCountryCode?: string
  onSessionLost: () => void
  onBack: () => void
}) {
  const t = useTranslations("createStore")
  const tSignup = useTranslations("signup")
  const locale = useLocale()
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)

  const { data: marketsData, loading: marketsLoading } = useQuery<{
    enabledCountryProfiles: { success: boolean; data: EnabledProfile[] }
  }>(ENABLED_COUNTRY_PROFILES, { fetchPolicy: "cache-first" })
  const markets = marketsData?.enabledCountryProfiles?.data ?? []

  const softSuggest =
    (phoneCountryCode &&
      markets.some((m) => m.country_code === phoneCountryCode) &&
      phoneCountryCode) ||
    markets[0]?.country_code ||
    ""

  const [step, setStep] = useState<"country" | "model" | "types">("country")
  const [businessModel, setBusinessModel] = useState<
    "OWN_PRODUCTS" | "SHOPPING_AGENT" | "HYBRID"
  >("OWN_PRODUCTS")
  const [homeCountry, setHomeCountry] = useState("")
  const [types, setTypes] = useState<StoreType[]>(["Sell online"])
  const [seeded, setSeeded] = useState(false)
  if (!seeded && markets.length > 0) {
    setSeeded(true)
    if (!homeCountry) setHomeCountry(softSuggest)
  }

  const [complete, { loading: creating }] =
    useMutation<CompleteVendorSignupResponse>(COMPLETE_VENDOR_SIGNUP)

  async function create(selected: StoreType[]) {
    if (creating) return
    if (!homeCountry) {
      sileo.error({ title: t("countryRequired") })
      setStep("country")
      return
    }

    try {
      const { data } = await complete({
        variables: {
          input: {
            token: draft.signup_token,
            store_name: t("temporaryName"),
            store_slug: mintTemporaryHandle(),
            home_country: homeCountry,
            business_model: businessModel,
            ...(selected.length > 0
              ? { category: selected.join(", ") }
              : {}),
          },
        },
      })

      const result = data?.completeVendorSignup?.data
      if (!result) return

      await setTokens(result.auth)
      sileo.success({
        title: tSignup("store.created"),
        description: t("createdRename"),
      })
      router.push(`/store/${result.shop_slug}`)
    } catch (err) {
      const code = getErrorCode(err)

      if (
        code === "SIGNUP_TOKEN_EXPIRED" ||
        code === "SIGNUP_TOKEN_INVALID" ||
        code === "SIGNUP_NOT_VERIFIED"
      ) {
        sileo.error({ title: tSignup("store.sessionExpired") })
        onSessionLost()
        return
      }

      if (code === "EMAIL_ALREADY_TAKEN" || code === "PHONE_ALREADY_TAKEN") {
        sileo.error({ title: tSignup("store.identifierTaken") })
        onSessionLost()
        return
      }

      if (code === "COUNTRY_NOT_AVAILABLE" || code === "COUNTRY_PROFILE_NOT_FOUND") {
        sileo.error({ title: t("noMarkets") })
        setStep("country")
        return
      }

      sileo.error({ title: tSignup("store.failed") })
    }
  }

  if (marketsLoading) {
    return (
      <StoreFrame title={t("step.country.title")} subtitle={t("step.country.subtitle")}>
        <p className="text-sm text-zinc-400">{t("creating")}</p>
      </StoreFrame>
    )
  }

  if (markets.length === 0) {
    return (
      <StoreFrame title={t("step.country.title")} subtitle={t("step.country.subtitle")}>
        <p className="text-sm text-zinc-300">{t("noMarkets")}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm text-white/80 underline"
        >
          {t("back")}
        </button>
      </StoreFrame>
    )
  }

  if (step === "country") {
    return (
      <StoreFrame
        title={t("step.country.title")}
        subtitle={t("step.country.subtitle")}
        aside={
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeftIcon className="size-5 rtl:rotate-180" />
          </button>
        }
      >
        <ul className="flex flex-col gap-2">
          {markets.map((m) => {
            const selected = homeCountry === m.country_code
            return (
              <li key={m.country_code}>
                <button
                  type="button"
                  onClick={() => setHomeCountry(m.country_code)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-start text-sm font-medium transition-colors ${
                    selected
                      ? "bg-white text-zinc-900"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <span>{regionName(m.country_code, locale)}</span>
                  <span className="text-xs opacity-70">{m.default_currency}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <Button
          type="button"
          onClick={() => {
            if (!homeCountry) {
              sileo.error({ title: t("countryRequired") })
              return
            }
            setStep("model")
          }}
          disabled={!homeCountry}
          className="mt-6 h-14 w-full rounded-xl text-base font-medium"
        >
          {t("continue")}
        </Button>
      </StoreFrame>
    )
  }

  if (step === "model") {
    const choices = [
      ["OWN_PRODUCTS", t("step.model.own")],
      ["SHOPPING_AGENT", t("step.model.agent")],
      ["HYBRID", t("step.model.hybrid")],
    ] as const
    return (
      <StoreFrame
        title={t("step.model.title")}
        subtitle={t("step.model.subtitle")}
        aside={
          <button
            type="button"
            onClick={() => setStep("country")}
            aria-label={t("back")}
            className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white"
          >
            <ArrowLeftIcon className="size-5 rtl:rotate-180" />
          </button>
        }
      >
        <ul className="flex flex-col gap-2">
          {choices.map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setBusinessModel(id)}
                className={`w-full rounded-xl px-4 py-3.5 text-start text-sm font-medium ${
                  businessModel === id ? "bg-white text-zinc-900" : "bg-white/10 text-white"
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="mt-6 h-14 w-full rounded-xl text-base font-medium"
          onClick={() => {
            if (businessModel === "SHOPPING_AGENT") void create([])
            else setStep("types")
          }}
        >
          {t("continue")}
        </Button>
      </StoreFrame>
    )
  }

  return (
    <StoreFrame
      title={t("step.types.title")}
      subtitle={t("step.types.subtitle")}
      action={
        <button
          type="button"
          onClick={() => void create([])}
          disabled={creating}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50"
        >
          {t("skip")}
        </button>
      }
      aside={
        <button
          type="button"
          onClick={() => setStep("model")}
          aria-label={t("back")}
          className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ArrowLeftIcon className="size-5 rtl:rotate-180" />
        </button>
      }
    >
      <StoreTypePicker value={types} onChange={setTypes} />

      <Button
        type="button"
        onClick={() => void create(types)}
        disabled={creating}
        className="mt-6 h-14 w-full rounded-xl text-base font-medium"
      >
        {creating ? t("creating") : t("continue")}
      </Button>

      <p className="mt-3 text-center text-xs text-zinc-500">
        {t("temporaryNote")}
      </p>
    </StoreFrame>
  )
}
