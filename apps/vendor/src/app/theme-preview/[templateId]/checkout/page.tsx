import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DoughnFontScope } from "@repo/storefront-templates/doughn"
import { HulloFontScope } from "@repo/storefront-templates/hullo"

import { DOUGHN_FONTS } from "@/features/storefront-templates/doughn-fonts"
import { DRIP_FONTS } from "@/features/storefront-templates/drip-fonts"
import { HULLO_FONTS } from "@/features/storefront-templates/hullo-fonts"

import { DoughnPreview } from "@/features/storefront-templates/doughn-preview"
import { DripPreview } from "@/features/storefront-templates/drip-preview"
import { HulloPreview } from "@/features/storefront-templates/hullo-preview"
import { JuratPreview } from "@/features/storefront-templates/jurat-preview"
import { PersonnePreview } from "@/features/storefront-templates/personne-preview"
import { RailPreview } from "@/features/storefront-templates/rail-preview"
import {
  isStorefrontTemplateId,
} from "@/features/storefront-templates/registry"

const HIDE_DASHBOARD_TEXTURE = "[data-dashboard-texture]{display:none}"
const PREVIEW_SWITCH =
  "fixed left-1/2 top-16 z-[10000] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-black shadow-md"

type Params = { params: Promise<{ templateId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { templateId } = await params
  if (!isStorefrontTemplateId(templateId)) return {}
  const t = await getTranslations("themeEditor.library")
  return { title: t("previewTitle", { name: t(`themes.${templateId}.name`) }) }
}

export default async function ThemePreviewCheckoutPage({ params }: Params) {
  const { templateId } = await params
  if (!isStorefrontTemplateId(templateId)) notFound()
  const t = await getTranslations("themeEditor.library")
  return (
    <>
      <style>{HIDE_DASHBOARD_TEXTURE}</style>
      <Link href={`/theme-preview/${templateId}`} className={PREVIEW_SWITCH}>
        {t("previewShop")}
      </Link>
      {templateId === "doughn" ? (
        <DoughnFontScope fonts={DOUGHN_FONTS}>
          <DoughnPreview />
        </DoughnFontScope>
      ) : templateId === "drip" ? (
        <DripPreview fonts={DRIP_FONTS} />
      ) : templateId === "rail" ? (
        <RailPreview />
      ) : templateId === "personne" ? (
        <PersonnePreview />
      ) : templateId === "jurat" ? (
        <JuratPreview />
      ) : (
        <HulloFontScope fonts={HULLO_FONTS}>
          <HulloPreview />
        </HulloFontScope>
      )}
    </>
  )
}
