"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  BanknoteIcon,
  BlocksIcon,
  ChartNoAxesColumnIcon,
  CreditCardIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayersIcon,
  PercentIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"

import {
  AppSidebar as UiAppSidebar,
  type NavGroup,
} from "@repo/ui/components/app-sidebar"
import type { Sidebar } from "@repo/ui/components/sidebar"

import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import { INTEGRATION_TYPES, integrationHref } from "@/features/integrations/nav"

/**
 * The admin console's nav. No shop scope, no trial CTA — this app is
 * platform-level.
 *
 * Two blocks: the platform's records at the top, then a **Settings** section.
 *
 * **Integrations is a plain entry, not a Settings group.** Each type is still
 * its own route — configured one at a time, linked to one at a time, each a
 * form with its own unsaved state — but the list of them belongs to the
 * integrations screen's own left rail (`IntegrationRail`), matching the vendor
 * dashboard's settings overlay. Listing the types here as well would put the
 * same three links on screen twice, and a collapsible group wrapping a single
 * link is a disclosure control with nothing to disclose.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("sidebar")
  const side =
    LOCALE_DIRECTIONS[resolveLocale(useLocale())] === "rtl" ? "right" : "left"

  const groups = React.useMemo(
    (): NavGroup[] => [
      {
        items: [
          // First: it is the only read-only screen here, and the one an admin
          // opens to find out whether anything needs doing on the others.
          {
            title: t("analytics"),
            url: "/analytics",
            icon: <ChartNoAxesColumnIcon />,
          },
          { title: t("users"), url: "/users", icon: <UsersIcon /> },
          // Directly under Users: a shop is inseparable from the account that
          // owns it, and the two screens are read one after the other.
          { title: t("shops"), url: "/shops", icon: <StoreIcon /> },
          {
            title: t("moderation"),
            url: "/moderation",
            icon: <ShieldAlertIcon />,
          },
          {
            title: t("withdrawals"),
            url: "/withdrawals",
            icon: <BanknoteIcon />,
          },
          {
            title: t("commissions"),
            url: "/commissions",
            icon: <PercentIcon />,
          },
          // Beside Commissions: the other rate the platform sets for every
          // shop at once, and the one that prices what Commissions is taken on.
          {
            title: t("paymentFees"),
            url: "/payment-fees",
            icon: <ReceiptIcon />,
          },
          { title: t("plans"), url: "/plans", icon: <LayersIcon /> },
          {
            title: t("subscribers"),
            url: "/subscribers",
            icon: <CreditCardIcon />,
          },
          {
            title: t("integrations"),
            // The rail's own first entry, so the sidebar lands on a real screen
            // rather than on an index that only redirects.
            url: integrationHref(INTEGRATION_TYPES[0]),
            icon: <BlocksIcon />,
          },
          {
            title: t("otpLogs"),
            url: "/otp-logs",
            icon: <ScrollTextIcon />,
          },
          {
            title: t("otpSettings"),
            url: "/settings/otp",
            icon: <KeyRoundIcon />,
          },
          {
            title: t("countryProfiles"),
            url: "/settings/country-profiles",
            icon: <GlobeIcon />,
          },
        ],
      },
    ],
    [t],
  )

  return <UiAppSidebar side={side} groups={groups} {...props} />
}
