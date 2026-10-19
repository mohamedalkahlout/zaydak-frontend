"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"

import { sectionUrl } from "@/features/settings/lib/routes"
import Image from "@/shared/components/app-image"

import { STOREFRONT_TEMPLATES, templatePreviewHref } from "../registry"
import { useShopStorefrontTemplate } from "../use-shop-template"

/**
 * The theme library on Online Store -> Themes. The cards are examples of a
 * custom theme. Preview opens that sample in a new tab. A theme of the
 * merchant's own is a conversation with us, on the existing Zaydak WhatsApp
 * screen. This screen does not write `storefront_template`.
 */
export function TemplateLibrary() {
  const t = useTranslations("themeEditor.library")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const { templateId } = useShopStorefrontTemplate(shopSlug)
  const contactHref = sectionUrl(shopSlug || null, "whatsapp")

  return (
    <section className="flex flex-col gap-4" aria-labelledby="template-library-title">
      <header className="flex flex-col gap-1">
        <h2 id="template-library-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {STOREFRONT_TEMPLATES.map((template) => {
          const inUse = templateId === template.id
          return (
            <li key={template.id} className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
              <Image
                src={template.thumbnail}
                alt=""
                sizes="(min-width: 640px) 480px, 100vw"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/70 p-5">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">{t(`themes.${template.id}.name`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`themes.${template.id}.description`)}</p>
                  {inUse ? (
                    <p className="mt-2 text-xs font-medium text-muted-foreground">{t("inUse")}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a
                        href={templatePreviewHref(template.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    {t("preview")}
                    <span className="sr-only">{t("opensInNewTab")}</span>
                  </Button>
                  <Button nativeButton={false} render={<Link href={contactHref} />}>
                    {t("contact")}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
