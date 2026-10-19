"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ShieldAlertIcon, StoreIcon, UserCheckIcon } from "lucide-react"

import { AbusiveReportsView } from "./abusive-reports-view"
import { BecameSellerView } from "./became-seller-view"
import { AuditAnomaliesView } from "./audit-anomalies-view"

type TabKey = "sellerRequests" | "reports" | "anomalies"

export function ModerationDashboard() {
  const t = useTranslations("moderation")
  const [activeTab, setActiveTab] = useState<TabKey>("sellerRequests")

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: "sellerRequests",
      label: t("tabs.sellerRequests"),
      icon: <StoreIcon className="size-4" />,
    },
    {
      key: "reports",
      label: t("tabs.reports"),
      icon: <ShieldAlertIcon className="size-4" />,
    },
    {
      key: "anomalies",
      label: t("tabs.anomalies"),
      icon: <UserCheckIcon className="size-4" />,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border/60 gap-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px outline-none ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active Tab View */}
      {activeTab === "sellerRequests" ? (
        <BecameSellerView />
      ) : activeTab === "reports" ? (
        <AbusiveReportsView />
      ) : (
        <AuditAnomaliesView />
      )}
    </div>
  )
}
