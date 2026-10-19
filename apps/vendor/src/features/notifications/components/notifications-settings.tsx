"use client"

import { Suspense, useState } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  RefreshCwIcon,
  ArrowLeftIcon,
  UserIcon,
  UsersIcon,
  PackageIcon,
  CodeXmlIcon,
  ChevronRightIcon,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { WebhooksPage } from "@/features/webhooks"
import { NOTIFICATION_SETTING, NOTIFICATION_CATALOG } from "../api"
import { SenderEmailCard } from "./sender-email-card"
import { BrandingCard } from "./branding-card"
import { ChannelsCard } from "./channels-card"
import { NotificationCatalog } from "./notification-catalog"
import { StaffNotificationsCard } from "./staff-notifications-card"
import { OrderSummaryCard } from "./order-summary-card"
import { TemplatePreviewPanel } from "./template-preview-panel"
import { TemplateEditor } from "./template-editor"
import type {
  NotificationSettingResult,
  NotificationCatalogResult,
} from "../types"

type View = "menu" | "customer" | "staff" | "fulfillment" | "webhooks"

/**
 * Module scope, not nested inside the component below. A component declared
 * during render is a new type on every render, so React unmounts and remounts
 * the subtree instead of updating it. This one closes over nothing — both
 * values arrive as props — so there was never anything holding it inside.
 */
function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" />
      {label}
    </button>
  )
}

/**
 * Settings → Notifications, laid out like Shopify: a landing screen with the
 * Reply-to card and a menu of sub-sections (Customer notifications, Staff
 * notifications, Fulfillment request, Webhooks). Selecting a menu row opens that
 * section inline — Webhooks lives here, matching Shopify's Notifications page.
 */
export function NotificationsSettings() {
  const t = useTranslations("notifications")
  const [view, setView] = useState<View>("menu")
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showBranding, setShowBranding] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  // Suspense readers so the server page's `PreloadQuery` streams the screen
  // with data — `useQuery` would not suspend and the SSR pass would ship the
  // loading state instead.
  const { data: settingData, refetch: refetchSetting } =
    useSuspenseQuery<NotificationSettingResult>(NOTIFICATION_SETTING, {
      fetchPolicy: "cache-and-network",
    })
  const { data: catalogData, refetch: refetchCatalog } =
    useSuspenseQuery<NotificationCatalogResult>(NOTIFICATION_CATALOG, {
      fetchPolicy: "cache-and-network",
    })

  const setting = settingData?.notificationSetting.data
  const templates = catalogData?.notificationCatalog.data ?? []

  // ── Customer notifications sub-section ────────────────────────────────────
  if (view === "customer") {
    if (selectedTemplate) {
      return (
        <TemplateEditor
          eventKey={selectedTemplate}
          onBack={() => setSelectedTemplate(null)}
          onChanged={() => void refetchCatalog()}
        />
      )
    }
    if (showBranding) {
      return (
        <div className="flex flex-col gap-5">
          <Back onClick={() => setShowBranding(false)} label={t("menu.customerTitle")} />
          <h2 className="text-base font-semibold">
            {t("console.customizeTemplates")}
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              {setting && (
                <BrandingCard
                  setting={setting}
                  onSaved={() => {
                    void refetchSetting()
                    setPreviewKey((k) => k + 1)
                  }}
                />
              )}
            </div>
            <TemplatePreviewPanel templates={templates} refreshKey={previewKey} />
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-5">
        <Back onClick={() => setView("menu")} label={t("menu.back")} />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t("menu.customerTitle")}</h2>
          <Button variant="outline" size="sm" onClick={() => setShowBranding(true)}>
            {t("console.customizeTemplates")}
          </Button>
        </div>
        <NotificationCatalog templates={templates} onSelect={setSelectedTemplate} />
      </div>
    )
  }

  // ── Staff notifications sub-section ───────────────────────────────────────
  if (view === "staff") {
    return (
      <div className="flex flex-col gap-5">
        <Back onClick={() => setView("menu")} label={t("menu.back")} />
        <StaffNotificationsCard />
        {setting && (
          <OrderSummaryCard
            setting={setting}
            onSaved={() => void refetchSetting()}
          />
        )}
      </div>
    )
  }

  // ── Fulfillment request sub-section ───────────────────────────────────────
  if (view === "fulfillment") {
    return (
      <div className="flex flex-col gap-5">
        <Back onClick={() => setView("menu")} label={t("menu.back")} />
        <h2 className="text-base font-semibold">{t("menu.fulfillmentTitle")}</h2>
        <div className="rounded-xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("menu.fulfillmentBody")}
        </div>
      </div>
    )
  }

  // ── Webhooks sub-section ──────────────────────────────────────────────────
  if (view === "webhooks") {
    return (
      <div className="flex flex-col gap-5">
        <Back onClick={() => setView("menu")} label={t("menu.back")} />
        <Suspense fallback={<WebhooksSkeleton />}>
          <WebhooksPage />
        </Suspense>
      </div>
    )
  }

  // ── Landing menu ──────────────────────────────────────────────────────────
  const rows: {
    icon: LucideIcon
    title: string
    desc: string
    onClick: () => void
  }[] = [
    {
      icon: UserIcon,
      title: t("menu.customerTitle"),
      desc: t("menu.customerDesc"),
      onClick: () => setView("customer"),
    },
    {
      icon: UsersIcon,
      title: t("menu.staffTitle"),
      desc: t("menu.staffDesc"),
      onClick: () => setView("staff"),
    },
    {
      icon: PackageIcon,
      title: t("menu.fulfillmentTitle"),
      desc: t("menu.fulfillmentDesc"),
      onClick: () => setView("fulfillment"),
    },
    {
      icon: CodeXmlIcon,
      title: t("menu.webhooksTitle"),
      desc: t("menu.webhooksDesc"),
      onClick: () => setView("webhooks"),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {setting ? (
        <>
          <SenderEmailCard
            setting={setting}
            onChanged={() => void refetchSetting()}
          />
          {/* Directly under the sender: "who they come from", then "where
              they go". */}
          <ChannelsCard
            setting={setting}
            onSaved={() => void refetchSetting()}
          />
        </>
      ) : (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <RefreshCwIcon className="size-4 animate-spin" />
          {t("console.loading")}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <li key={row.title}>
                <button
                  type="button"
                  onClick={row.onClick}
                  className="flex w-full items-center gap-4 px-4 py-4 text-start transition-colors hover:bg-muted/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {row.desc}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function WebhooksSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-16 w-full" />
        ))}
      </div>
    </div>
  )
}
