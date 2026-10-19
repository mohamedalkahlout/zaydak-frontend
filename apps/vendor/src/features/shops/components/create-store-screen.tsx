"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { sileo } from "sileo";

import {
  CREATE_SHOP,
  ENABLED_COUNTRY_PROFILES,
} from "@/features/shops/api";
import type { CreateShopResponse } from "@/features/shops/types";
import { useAuthStore } from "@/shared/stores/auth";
import { refreshAccessToken } from "@/shared/lib/auth/refresh";
import { regionName } from "@/shared/lib/country-name";
import { mintTemporaryHandle } from "../lib/temporary-store";
import { type StoreType } from "../lib/store-types";
import { StoreFrame } from "./store-frame";
import { StoreTypePicker } from "./store-type-picker";

type EnabledProfile = {
  country_code: string;
  default_currency: string;
};

type EnabledProfilesResult = {
  enabledCountryProfiles: {
    success: boolean;
    data: EnabledProfile[];
  };
};

/**
 * Create Store asks for the declared business country first (CountryProfile),
 * then optional store types. Country is never guessed from IP or phone —
 * those may only preselect.
 */
export function CreateStoreScreen() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("createStore");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: marketsData, loading: marketsLoading } =
    useQuery<EnabledProfilesResult>(ENABLED_COUNTRY_PROFILES, {
      fetchPolicy: "cache-first",
    });
  const markets = marketsData?.enabledCountryProfiles?.data ?? [];

  // Soft preselect: only enabled market when there is one (Palestine launch).
  const suggested = markets[0]?.country_code || "";

  const [step, setStep] = useState<"country" | "types">("country");
  const [homeCountry, setHomeCountry] = useState("");
  const [types, setTypes] = useState<StoreType[]>(["Sell online"]);

  // Seed suggested country once markets load (soft preselect only).
  const [seeded, setSeeded] = useState(false);
  if (!seeded && markets.length > 0) {
    setSeeded(true);
    if (!homeCountry) setHomeCountry(suggested);
  }

  const [createShop, { loading: creating }] =
    useMutation<CreateShopResponse>(CREATE_SHOP);

  async function create(selected: StoreType[]) {
    if (creating) return;
    if (!homeCountry) {
      sileo.error({ title: t("countryRequired") });
      setStep("country");
      return;
    }

    const input: Record<string, unknown> = {
      name: t("temporaryName"),
      slug: mintTemporaryHandle(),
      home_country: homeCountry,
    };
    if (selected.length > 0) input.description = selected.join(", ");

    try {
      const { data: result } = await createShop({ variables: { input } });
      if (!result?.createShop?.success) return;

      if (isAuthenticated) {
        try {
          await refreshAccessToken();
        } catch {
          // Non-fatal.
        }
      }

      sileo.success({ title: t("created"), description: t("createdRename") });
      const newSlug = result.createShop.data?.slug;
      router.push(newSlug ? `/store/${newSlug}` : "/store");
    } catch {
      // Error link surfaces the message.
    }
  }

  if (marketsLoading) {
    return (
      <StoreFrame title={t("step.country.title")} subtitle={t("step.country.subtitle")}>
        <p className="text-sm text-zinc-400">{t("creating")}</p>
      </StoreFrame>
    );
  }

  if (markets.length === 0) {
    return (
      <StoreFrame title={t("step.country.title")} subtitle={t("step.country.subtitle")}>
        <p className="text-sm text-zinc-300">{t("noMarkets")}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 text-sm text-white/80 underline"
        >
          {t("back")}
        </button>
      </StoreFrame>
    );
  }

  if (step === "country") {
    return (
      <StoreFrame
        title={t("step.country.title")}
        subtitle={t("step.country.subtitle")}
        aside={
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t("back")}
            className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeftIcon className="size-5 rtl:rotate-180" />
          </button>
        }
      >
        <ul className="flex flex-col gap-2">
          {markets.map((m) => {
            const selected = homeCountry === m.country_code;
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
            );
          })}
        </ul>

        <Button
          type="button"
          onClick={() => {
            if (!homeCountry) {
              sileo.error({ title: t("countryRequired") });
              return;
            }
            setStep("types");
          }}
          disabled={!homeCountry}
          className="mt-6 h-14 w-full rounded-xl text-base font-medium"
        >
          {t("continue")}
        </Button>
      </StoreFrame>
    );
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
          onClick={() => setStep("country")}
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
  );
}
