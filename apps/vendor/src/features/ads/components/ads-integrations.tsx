"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  BarChart3Icon,
  Link2Icon,
  TargetIcon,
  UserPlusIcon,
  UsersIcon,
  PlusIcon,
} from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useAdsStore } from "../hooks/use-ads-store"
import { isAdPlatform, adsTabUrl } from "../lib/routes"
import type { AdPlatform } from "../types"
import { PlatformIcon } from "./platform-icon"
import { PlatformPills } from "./platform-pills"

const BENEFIT_ICONS = [
  BarChart3Icon,
  TargetIcon,
  UserPlusIcon,
  UsersIcon,
] as const

/**
 * Per-platform connection scaffolding. Connect writes a local demo state —
 * real OAuth / Events API / catalog sync are follow-ups.
 */
export function AdsIntegrations() {
  const t = useTranslations("ads")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const {
    connection,
    connect,
    disconnect,
    savePixel,
    createProductSet,
  } = useAdsStore(shopSlug)

  const rawPlatform = searchParams.get("platform")
  const platform: AdPlatform = isAdPlatform(rawPlatform) ? rawPlatform : "google"
  const conn = connection(platform)

  const setPlatform = (next: AdPlatform) => {
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("platform", next)
    router.replace(`?${qs.toString()}`, { scroll: false })
  }

  const [pixelDraft, setPixelDraft] = useState(conn.pixel_id ?? "")
  const [seededFrom, setSeededFrom] = useState(
    `${platform}:${conn.pixel_id ?? ""}`,
  )
  const seedKey = `${platform}:${conn.pixel_id ?? ""}`
  if (seedKey !== seededFrom) {
    setSeededFrom(seedKey)
    setPixelDraft(conn.pixel_id ?? "")
  }

  const dirty =
    conn.connected && (pixelDraft.trim() !== (conn.pixel_id ?? "").trim())
  const show = useUnsavedBarStore((s) => s.show)
  const hide = useUnsavedBarStore((s) => s.hide)
  const setError = useUnsavedBarStore((s) => s.setError)

  useEffect(() => {
    if (!dirty) {
      hide()
      return
    }
    show({
      label: t("unsavedChanges"),
      saving: false,
      onSave: () => {
        savePixel(platform, pixelDraft.trim())
        sileo.success({ title: t("toasts.pixelSaved") })
      },
      onDiscard: () => {
        setPixelDraft(conn.pixel_id ?? "")
        setError(null)
      },
    })
  }, [
    dirty,
    hide,
    show,
    setError,
    t,
    savePixel,
    platform,
    pixelDraft,
    conn.pixel_id,
  ])

  useEffect(() => () => hide(), [hide])

  useLeaveGuard({
    when: dirty,
    allow: (path) => path.includes("/marketing/ads/integrations"),
    onLeave: () => {
      setPixelDraft(conn.pixel_id ?? "")
      setError(null)
      hide()
    },
  })

  const onConnect = () => {
    connect(platform)
    sileo.success({ title: t("toasts.connectedDemo") })
  }

  const onDisconnect = () => {
    disconnect(platform)
    sileo.success({ title: t("toasts.disconnected") })
  }

  const benefits = [0, 1, 2, 3] as const

  return (
    <div className="flex flex-col gap-5">
      <PlatformPills value={platform} onChange={setPlatform} />

      <Card className="overflow-hidden border-emerald-200/80 bg-linear-to-br from-emerald-50 to-card dark:border-emerald-900/40 dark:from-emerald-950/40">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PlatformIcon platform={platform} />
              <Badge variant={conn.connected ? "default" : "secondary"}>
                {conn.connected
                  ? t("integrations.connected")
                  : t("integrations.notConnected")}
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {t(`integrations.hero.${platform}.title`)}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t(`integrations.hero.${platform}.body`)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {conn.connected ? (
                <Button type="button" variant="outline" onClick={onDisconnect}>
                  {t("integrations.disconnect")}
                </Button>
              ) : (
                <Button type="button" className="gap-1.5" onClick={onConnect}>
                  <Link2Icon className="size-4" />
                  {t("integrations.connect", {
                    platform: t(`platforms.${platform}`),
                  })}
                </Button>
              )}
              {shopSlug ? (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={adsTabUrl(shopSlug, "campaigns")} />}
                >
                  {t("integrations.startCampaign")}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("integrations.demoNote")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatusCard
              title={t("integrations.pixelTitle")}
              badge={
                conn.pixel_active
                  ? t("integrations.active")
                  : t("integrations.inactive")
              }
              badgeTone={conn.pixel_active ? "success" : "muted"}
              detail={
                conn.connected && conn.pixel_id
                  ? conn.pixel_id
                  : t("integrations.pixelMissing")
              }
            />
            <StatusCard
              title={t(`integrations.catalogTitle.${platform}`)}
              badge={
                conn.catalog_linked
                  ? t("integrations.linked")
                  : t("integrations.notLinked")
              }
              badgeTone={conn.catalog_linked ? "success" : "muted"}
              detail={t(`integrations.catalogDetail.${platform}`)}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-base font-semibold">
          {t("integrations.benefitsHeading")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`integrations.benefitsIntro.${platform}`)}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {benefits.map((i) => {
            const Icon = BENEFIT_ICONS[i]
            return (
              <Card key={i} size="sm">
                <CardHeader className="gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-sm">
                    {t(`integrations.benefits.${i}.title`)}
                  </CardTitle>
                  <CardDescription>
                    {t(`integrations.benefits.${i}.body`)}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </div>

      {conn.connected && platform === "snapchat" ? (
        <SnapchatConnectedPanel
          pixelDraft={pixelDraft}
          onPixelChange={setPixelDraft}
          accounts={conn.accounts}
          catalogSynced={conn.catalog_synced}
          catalogTotal={conn.catalog_total}
          lastSyncAt={conn.last_sync_at}
          productSets={conn.product_sets}
          locale={locale}
          onAddProductSet={(name) => createProductSet("snapchat", name)}
        />
      ) : null}

      {conn.connected && platform !== "snapchat" ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("integrations.footerHint")}
            </p>
            {shopSlug ? (
              <Button
                nativeButton={false}
                render={<Link href={adsTabUrl(shopSlug, "campaigns")} />}
              >
                {t("integrations.startCampaign")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function StatusCard({
  title,
  badge,
  badgeTone,
  detail,
}: {
  title: string
  badge: string
  badgeTone: "success" | "muted"
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge
          variant={badgeTone === "success" ? "default" : "secondary"}
          className={
            badgeTone === "success"
              ? "bg-emerald-600 text-white hover:bg-emerald-600"
              : undefined
          }
        >
          {badge}
        </Badge>
      </div>
      <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function SnapchatConnectedPanel({
  pixelDraft,
  onPixelChange,
  accounts,
  catalogSynced,
  catalogTotal,
  lastSyncAt,
  productSets,
  locale,
  onAddProductSet,
}: {
  pixelDraft: string
  onPixelChange: (value: string) => void
  accounts: { id: string; name: string }[]
  catalogSynced: number
  catalogTotal: number
  lastSyncAt: string | null
  productSets: { id: string; name: string }[]
  locale: string
  onAddProductSet: (name: string) => void
}) {
  const t = useTranslations("ads.integrations.snapchat")

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pixelHeading")}</CardTitle>
          <CardDescription>{t("pixelHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="snap-pixel-id">{t("pixelLabel")}</Label>
          <Input
            id="snap-pixel-id"
            value={pixelDraft}
            onChange={(e) => onPixelChange(e.target.value)}
            placeholder={t("pixelPlaceholder")}
            className="font-mono"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accountsHeading")}</CardTitle>
          <CardDescription>{t("accountsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("accountsEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#FFFC00] text-xs font-bold text-zinc-900">
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium">{account.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("catalogHeading")}</CardTitle>
          <CardDescription>{t("catalogHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {t("catalogProgress", {
              synced: catalogSynced,
              total: catalogTotal,
            })}
          </p>
          <p className="text-muted-foreground">
            {lastSyncAt
              ? t("catalogLastSync", {
                  when: new Date(lastSyncAt).toLocaleString(locale),
                })
              : t("catalogNeverSynced")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t("setsHeading")}</CardTitle>
            <CardDescription>{t("setsHint")}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => onAddProductSet(t("setsDefaultName"))}
          >
            <PlusIcon className="size-3.5" />
            {t("setsAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {productSets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("setsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {productSets.map((set) => (
                <li key={set.id} className="px-3 py-2 text-sm">
                  {set.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
