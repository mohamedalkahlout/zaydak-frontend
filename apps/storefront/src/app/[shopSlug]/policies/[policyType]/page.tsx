import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowRight, ShieldCheck, Store } from "lucide-react"

import { fetchShopShell } from "@/features/shop/lib/shop-server"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"
import { serverTenant } from "@/shared/lib/tenant-server"
import { shopHomeHref } from "@/shared/lib/tenant"
import { Button } from "@repo/ui/components/button"

export const dynamic = "force-dynamic"

const POLICY_KEYS = ["refund", "privacy", "terms", "shipping"] as const
type PolicyType = (typeof POLICY_KEYS)[number]

interface PolicyPageProps {
  params: Promise<{
    shopSlug: string
    policyType: string
  }>
}

function getPolicyField(
  policyType: PolicyType,
  policies?: {
    refund_policy?: string | null
    privacy_policy?: string | null
    terms_of_service?: string | null
    shipping_policy?: string | null
  } | null,
): string | null {
  if (!policies) return null
  switch (policyType) {
    case "refund":
      return policies.refund_policy?.trim() || null
    case "privacy":
      return policies.privacy_policy?.trim() || null
    case "terms":
      return policies.terms_of_service?.trim() || null
    case "shipping":
      return policies.shipping_policy?.trim() || null
    default:
      return null
  }
}

export async function generateMetadata({
  params,
}: PolicyPageProps): Promise<Metadata> {
  const { shopSlug, policyType } = await params
  if (!POLICY_KEYS.includes(policyType as PolicyType)) return {}

  const [shop, t] = await Promise.all([
    fetchShopShell(shopSlug),
    getTranslations("shop.policies"),
  ])

  if (!shop) return {}
  const title = t(`types.${policyType as PolicyType}`)

  return {
    title: `${title} | ${shop.name}`,
    description: `${title} - ${shop.name}`,
    alternates: {
      // The shop's CURRENT handle and its promoted domain — see
      // `canonicalShopBase`. A canonical naming an address that redirects is a
      // canonical naming nothing.
      canonical: `${await canonicalShopBase(shop.slug)}/policies/${policyType}`,
    },
  }
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { shopSlug, policyType } = await params
  if (!POLICY_KEYS.includes(policyType as PolicyType)) {
    notFound()
  }

  const validPolicyType = policyType as PolicyType
  const [shop, t] = await Promise.all([
    fetchShopShell(shopSlug),
    getTranslations("shop.policies"),
  ])

  if (!shop) {
    notFound()
  }

  const content = getPolicyField(validPolicyType, shop.settings?.policies)
  if (!content) {
    notFound()
  }

  const tenant = await serverTenant(shopSlug)
  const policyTitle = t(`types.${validPolicyType}`)

  return (
    <div className="shop-container py-8 sm:py-12 lg:py-16">
      {/* Breadcrumb / Navigation */}
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={shopHomeHref(tenant.base)}
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <Store className="size-3.5" />
          <span>{shop.name}</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{policyTitle}</span>
      </div>

      <div className="mx-auto max-w-3xl">
        {/* Header Header card */}
        <div className="border-b border-border/80 pb-6 mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <ShieldCheck className="size-3.5" />
            {t("storePolicy")}
          </div>

          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {policyTitle}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {shop.name}
          </p>
        </div>

        {/* Policy Content */}
        <article className="prose prose-neutral max-w-none text-base leading-relaxed text-foreground/90 whitespace-pre-wrap font-normal">
          {content}
        </article>

        {/* Footer actions */}
        <div className="mt-12 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={shopHomeHref(tenant.base)} />}
            className="gap-2 w-full sm:w-auto"
          >
            <span className="inline-block rtl:rotate-180">
              <ArrowLeft className="size-4" />
            </span>
            {t("backToShop")}
          </Button>

          {shop.settings?.email && (
            <p className="text-xs text-muted-foreground text-center sm:text-end">
              {t("contactStore")}:{" "}
              <a
                href={`mailto:${shop.settings.email}`}
                className="text-primary hover:underline font-medium"
              >
                {shop.settings.email}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
