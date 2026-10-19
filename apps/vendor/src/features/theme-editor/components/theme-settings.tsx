"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"

import { MOCK_SHOP } from "../mocks/mock-shop"

export function ThemeSettings() {
  const t = useTranslations("themeEditor")
  const params = useParams<{ shopSlug: string }>()

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/80 px-4 py-3.5">
        <h2 className="font-medium leading-5">{t("themeSettings")}</h2>
      </div>
      <div className="flex flex-col gap-8 overflow-y-auto px-4 py-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("brandColors")}
          </h3>
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/8">
            <ColorRow label={t("primary")} hex={MOCK_SHOP.primary} />
            <ColorRow label={t("secondary")} hex={MOCK_SHOP.secondary} />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("brandColorsHint")}</p>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link href={`/store/${params.shopSlug}/settings/general/brand`} />
            }
          >
            {t("editBrandColors")}
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("storeIdentity")}
          </h3>
          <p className="text-sm">{MOCK_SHOP.name}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{MOCK_SHOP.description}</p>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="mt-1 w-fit"
            render={
              <Link href={`/store/${params.shopSlug}/settings/general`} />
            }
          >
            {t("editStoreInformation")}
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("previewLocale")}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("previewLocaleHint")}</p>
        </section>
      </div>
    </aside>
  )
}

function ColorRow({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span
          className="size-5 rounded-md ring-1 ring-foreground/15"
          style={{ background: hex }}
          aria-hidden
        />
        {hex}
      </span>
    </div>
  )
}
