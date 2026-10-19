"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config";

import { AppSidebar as UiAppSidebar, type NavItem } from "@repo/ui/components/app-sidebar";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/sidebar";
import { useActiveShopStore } from "@/shared/stores/active-shop";
import { PlanStatusCard } from "@/features/plan/components/plan-status-card";
import {
  HomeIcon,
  ClipboardListIcon,
  TagIcon,
  UsersIcon,
  MegaphoneIcon,
  FileTextIcon,
  BarChart3Icon,
  SettingsIcon,
  SparklesIcon,
  StoreIcon,
  WalletIcon,
} from "lucide-react";

/**
 * Vendor's sidebar: the shared shell from `@repo/ui`, fed this app's nav tree,
 * settings link, and trial CTA.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // URL-derived so it matches between SSR and client (no localStorage flicker).
  const params = useParams<{ shopSlug?: string }>();
  const shopSlug = params?.shopSlug ?? null;
  const t = useTranslations("sidebar");
  const side =
    LOCALE_DIRECTIONS[resolveLocale(useLocale())] === "rtl" ? "right" : "left";
  const settingsUrl = shopSlug
    ? `/store/${shopSlug}/settings`
    : "/store";

  const nav = React.useMemo((): NavItem[] => {
    const base = shopSlug ? `/store/${shopSlug}` : "/store";
    return [
      { title: t("home"), url: base, icon: <HomeIcon /> },
      {
        title: t("orders"),
        url: `${base}/orders`,
        icon: <ClipboardListIcon />,
        items: [
          { title: t("drafts"), url: `${base}/orders/drafts` },
          { title: t("returns"), url: `${base}/orders/returns` },
        ],
      },
      { title: t("balance"), url: `${base}/balance`, icon: <WalletIcon /> },
      {
        title: t("products"),
        url: `${base}/products`,
        icon: <TagIcon />,
        items: [
          { title: t("collections"), url: `${base}/products/collections` },
          // { title: t("tags"), url: `${base}/products/tags` },
          { title: t("inventory"), url: `${base}/products/inventory` },
          {
            title: t("purchaseOrders"),
            url: `${base}/products/inventory/purchase-orders`,
          },
          {
            title: t("transfers"),
            url: `${base}/products/inventory/transfers`,
          },

          // {
          //   title: t("suppliers"),
          //   url: `${base}/products/inventory/suppliers`,
          // },
          {
            title: t("locations"),
            url: `${base}/products/inventory/locations`,
          },
        ],
      },
      {
        title: t("customers"),
        url: `${base}/customers`,
        icon: <UsersIcon />,
        items: [
          { title: t("segments"), url: `${base}/segments` },
          { title: t("reviews"), url: `${base}/reviews` },
          // Under Customers rather than beside Settings → WhatsApp: that screen
          // is where a number is connected, and this is where the people who
          // wrote to it are read. One is configuration, the other is work.
          { title: t("whatsappInbox"), url: `${base}/whatsapp-inbox` },
        ],
      },
      {
        title: t("marketing"),
        url: `${base}/marketing/ads`,
        icon: <MegaphoneIcon />,
        items: [
          { title: t("ads"), url: `${base}/marketing/ads` },
          { title: t("coupons"), url: `${base}/coupons` },
          { title: t("abandonedCarts"), url: `${base}/marketing/carts` },
        ],
      },
      {
        title: t("content"),
        url: `${base}/content`,
        icon: <FileTextIcon />,
        items: [{ title: t("files"), url: `${base}/content/files` }],
      },
      {
        title: t("onlineStore"),
        url: `${base}/online-store/themes`,
        icon: <StoreIcon />,
        items: [
          { title: t("themes"), url: `${base}/online-store/themes` },
          { title: t("navigation"), url: `${base}/online-store/navigation` },
          { title: t("preferences"), url: `${base}/online-store/preferences` },
        ],
      },
      {
        title: t("analytics"),
        url: `${base}/analytics`,
        icon: <BarChart3Icon />,
        items: [
          { title: t("reports"), url: `${base}/analytics/reports` },
          { title: t("targets"), url: `${base}/analytics/targets` },
          { title: t("attribution"), url: `${base}/analytics/attribution` },
          { title: t("customerInsights"), url: `${base}/analytics/customers` },
          { title: t("negotiations"), url: `${base}/analytics/negotiations` },
        ],
      },
      { title: t("sidekick"), url: `${base}/ai`, icon: <SparklesIcon /> },
    ];
  }, [shopSlug, t]);

  // Mirror the URL slug into the store so Apollo's X-SHOP link and
  // login-redirect logic see the current shop.
  const setSlug = useActiveShopStore((s) => s.setSlug);
  React.useEffect(() => {
    if (shopSlug) setSlug(shopSlug);
  }, [shopSlug, setSlug]);

  return (
    <UiAppSidebar
      side={side}
      items={nav}
      bottom={
        <SidebarMenu className="mt-auto px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("settings")}
              render={<Link href={settingsUrl} />}
            >
              <SettingsIcon />
              <span>{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      }
      // Always present once `myPlan` answers, and every line of it derived. The
      // card that used to live here was hardcoded — it announced a three-day
      // trial and a "$1" price to every store forever, in a currency this
      // product does not use. `key` remounts the card on shop switch so its
      // network-only first fetch cannot paint the previous shop's cached plan.
      footer={
        <PlanStatusCard key={shopSlug ?? "none"} shopSlug={shopSlug} />
      }
      {...props}
    />
  );
}
