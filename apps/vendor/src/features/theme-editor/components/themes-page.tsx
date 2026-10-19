"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"

import { TemplateLibrary } from "@/features/storefront-templates/components/template-library"
import { useShopStorefrontTemplate } from "@/features/storefront-templates/use-shop-template"

import { MOCK_SHOP } from "../mocks/mock-shop"

export function ThemesPage() {
  const t = useTranslations("themeEditor")
  const params = useParams<{ shopSlug: string }>()
  const { templateId } = useShopStorefrontTemplate(params?.shopSlug)
  const editorHref = `/store/${params.shopSlug}/online-store/editor?template=home`
  const currentName = templateId
    ? t(`library.themes.${templateId}.name`)
    : MOCK_SHOP.name

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("themesTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("themesSubtitle")}</p>
      </header>

      <article className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div
          className="h-44 bg-[#F6F7F5]"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 18% 0%, rgba(142, 235, 215, 0.95) 0%, transparent 58%), linear-gradient(165deg, #F6F7F5 0%, #E7F7F3 100%)",
          }}
        />
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/70 p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("currentTheme")}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{currentName}</h2>
          </div>
          <Button nativeButton={false} render={<Link href={editorHref} />}>
            {t("customize")}
          </Button>
        </div>
      </article>

      <TemplateLibrary />
    </div>
  )
}
