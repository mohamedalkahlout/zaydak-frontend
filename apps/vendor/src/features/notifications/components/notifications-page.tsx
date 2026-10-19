"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui/components/tabs"
import { NotificationsInbox } from "./notifications-inbox"
import { NotificationPreferences } from "./notification-preferences"

/**
 * `/store/[shopSlug]/notifications` — the "View all" destination behind the
 * header bell. Inbox is the full paged history with per-row actions;
 * Preferences is the per-type in-app/email matrix.
 */
export function NotificationsPage() {
  const t = useTranslations("notifications")
  const [tab, setTab] = useState("inbox")

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
        <TabsList>
          <TabsTrigger value="inbox">{t("tabs.inbox")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("tabs.preferences")}</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <NotificationsInbox />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  )
}
