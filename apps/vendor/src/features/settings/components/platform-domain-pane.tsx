"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { GlobeIcon, InfoIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { SHOP_DOMAINS } from "../api/domains";
import { domainViewUrl } from "../lib/domain-urls";
import { PLATFORM_DOMAIN_ID, sectionUrl } from "../lib/routes";
import { storefrontStatus } from "../lib/storefront-status";
import {
  ChangeDomainTypeDialog,
  domainTypeOf,
  type DomainTypeTarget,
} from "./domains/change-domain-type-dialog";
import { DomainStatusPill } from "./domains/domain-status-pill";
import { DomainTargetCard } from "./domains/domain-target-card";
import type { DomainRow } from "./domains/domains-table";
import {
  SettingsHeaderActions,
  SettingsHeaderTitle,
} from "./settings-header-slots";
import { useSettingsShop } from "./settings-shell";

/**
 * The platform subdomain's own page, at `/settings/domains/platform`.
 *
 * **It is a separate pane from `DomainDetailPane` rather than a branch inside
 * it**, because that screen is six hundred lines about DNS the merchant has to
 * edit and this address has none: nobody points `<slug>.<root>` anywhere, the
 * platform already answers for it, and every readiness check, record table,
 * provider login and Verify button would render as an empty box or a lie.
 * Threading an `isPlatform` flag through all of it would have meant a dozen
 * conditionals whose only job is to hide things.
 *
 * What the address genuinely has is a *role*, and that is the whole reason the
 * page exists: this is where primacy is handed back. Before it, the platform
 * row was the one address in the table that opened nothing, and once a custom
 * domain was promoted the only way to make `<slug>.<root>` the shop's address
 * again was to delete the custom domain.
 *
 * **Its status is about the storefront, not about DNS.** `PENDING` here means
 * the shop is unapproved or switched off, so the reason is said in words rather
 * than left as a pill a merchant would read as a setup step they had missed.
 */
export function PlatformDomainPane() {
  const shop = useSettingsShop();
  const t = useTranslations("settings.domains");
  const params = useParams<{ shopSlug?: string }>();
  const shopSlug = params?.shopSlug ?? shop?.slug ?? null;

  const { data, loading } = useQuery(SHOP_DOMAINS, { skip: !shop });
  const [changing, setChanging] = useState<DomainTypeTarget | null>(null);

  if (!shop) return null;

  const rows =
    (data as { shopDomains?: { data?: DomainRow[] } } | undefined)?.shopDomains
      ?.data ?? [];
  const row = rows.find((entry) => entry.kind === "PLATFORM_SUBDOMAIN");
  const listUrl = sectionUrl(shopSlug, "domains");

  if (!row) {
    if (loading) {
      return (
        <SettingsHeaderTitle>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
        </SettingsHeaderTitle>
      );
    }
    // The server omits this row entirely when the deployment has no apex, so
    // "not found" here is path-scoping rather than a missing record — the shop
    // lives at `<storefront>/<handle>` and has no subdomain to describe.
    return (
      <>
        <SettingsHeaderTitle>
          <h1 className="font-heading text-xl font-semibold">
            {t("platform.noneTitle")}
          </h1>
        </SettingsHeaderTitle>
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">{t("platform.noneBody")}</p>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href={listUrl} />}
          >
            {t("detail.back")}
          </Button>
        </div>
      </>
    );
  }

  const status = storefrontStatus(shop);
  const { type, redirectTarget } = domainTypeOf(row, rows);

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeaderTitle>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* `dir="ltr"` because a hostname rendered right-to-left has its
                segments visually reversed, and the dashboard runs RTL in
                Arabic. */}
            <h1
              dir="ltr"
              className="min-w-0 truncate font-heading text-xl font-semibold"
            >
              {row.hostname}
            </h1>
            <DomainStatusPill
              state={status === "connected" ? "CONNECTED" : "NEEDS_SETUP"}
            />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {t("platform.managedBy")}
          </p>
        </div>
      </SettingsHeaderTitle>

      <SettingsHeaderActions>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={domainViewUrl(row, shop.slug)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          {t("detail.view")}
        </Button>
      </SettingsHeaderActions>

      <section className="flex items-start gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        >
          <GlobeIcon className="size-5" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="font-heading text-base leading-snug font-medium">
            {t("platform.aboutTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.rich("platform.aboutBody", {
              hostname: row.hostname,
              ltr: (chunks) => <span dir="ltr">{chunks}</span>,
            })}
          </p>
          {/* The reason the pill above is not green, said in words. A merchant
              reading "Needs setup" over an address with nothing to set up would
              go looking for DNS records that do not exist. */}
          {status !== "connected" && (
            <p className="flex gap-2 pt-1 text-sm text-amber-800 dark:text-amber-300">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <span>{t(`banner.${status}`)}</span>
            </p>
          )}
        </div>
      </section>

      <DomainTargetCard
        type={type}
        redirectTarget={redirectTarget}
        onChange={() =>
          setChanging({
            id: PLATFORM_DOMAIN_ID,
            hostname: row.hostname,
            kind: "PLATFORM_SUBDOMAIN",
            status: row.status,
            is_primary: row.is_primary,
          })
        }
      />

      <ChangeDomainTypeDialog
        domain={changing}
        currentType={type}
        onOpenChange={(open) => !open && setChanging(null)}
      />
    </div>
  );
}
