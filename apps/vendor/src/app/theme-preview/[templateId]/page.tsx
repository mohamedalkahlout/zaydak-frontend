import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DoughnTemplate } from "@repo/storefront-templates/doughn"
import { DripTemplate } from "@repo/storefront-templates/drip"
import { HulloTemplate } from "@repo/storefront-templates/hullo"
import { JuratTemplate } from "@repo/storefront-templates/jurat"
import { PersonneTemplate } from "@repo/storefront-templates/personne"
import { RailTemplate } from "@repo/storefront-templates/rail"

import { DOUGHN_FONTS } from "@/features/storefront-templates/doughn-fonts"
import { DRIP_FONTS } from "@/features/storefront-templates/drip-fonts"
import { HULLO_FONTS } from "@/features/storefront-templates/hullo-fonts"
import { JURAT_FONTS } from "@/features/storefront-templates/jurat-fonts"
import { PERSONNE_FONTS } from "@/features/storefront-templates/personne-fonts"
import { isStorefrontTemplateId, type StorefrontTemplateId } from "@/features/storefront-templates/registry"

/**
 * A storefront template at full size, with its sample shop.
 *
 * Outside `store/` on purpose: a template owns the window's scroll (its hero is
 * a pinned scroll scene), so it cannot render inside `DashboardShell`. It is
 * behind sign-in all the same — `/theme-preview` is one of `proxy.ts`'s
 * protected prefixes — and it reads no shop data.
 */
const PREVIEWS: Record<StorefrontTemplateId, () => React.ReactNode> = {
  doughn: () => <DoughnTemplate fonts={DOUGHN_FONTS} />,
  hullo: () => <HulloTemplate fonts={HULLO_FONTS} />,
  drip: () => <DripTemplate fonts={DRIP_FONTS} />,
  rail: () => <RailTemplate />,
  personne: () => <PersonneTemplate fonts={PERSONNE_FONTS} />,
  jurat: () => <JuratTemplate fonts={JURAT_FONTS} />,
}

// The dashboard's grain overlay (root layout) belongs to the dashboard, not to the
// storefront being previewed. A plain <style> in the page, so it leaves with the page.
const HIDE_DASHBOARD_TEXTURE = "[data-dashboard-texture]{display:none}"

type Params = { params: Promise<{ templateId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { templateId } = await params
  if (!isStorefrontTemplateId(templateId)) return {}
  const t = await getTranslations("themeEditor.library")
  return { title: t("previewTitle", { name: t(`themes.${templateId}.name`) }) }
}

export default async function ThemePreviewPage({ params }: Params) {
  const { templateId } = await params
  if (!isStorefrontTemplateId(templateId)) notFound()
  const t = await getTranslations("themeEditor.library")
  return (
    <>
      <style>{HIDE_DASHBOARD_TEXTURE}</style>
      <Link href={`/theme-preview/${templateId}/checkout`} className={PREVIEW_SWITCH}>
        {t("previewCheckout")}
      </Link>
      {PREVIEWS[templateId]()}
    </>
  )
}

const PREVIEW_SWITCH =
  "fixed end-4 top-4 z-[10000] rounded-full bg-white px-3 py-1.5 text-sm font-medium text-black shadow-md"
