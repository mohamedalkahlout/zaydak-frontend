"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, InfoIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ButtonGroup } from "@repo/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useAiChatStore } from "@/features/ai/store-chat";

import { SHOP_DOMAINS } from "../api/domains";
import {
  platformRootFrom,
  ROOT_DOMAIN,
  STOREFRONT_HOST,
} from "../lib/domain-urls";
import { domainUrl } from "../lib/routes";
import { handlePreview } from "../lib/shop-handle";
import { storefrontStatus } from "../lib/storefront-status";
import { BuyDomainDialog } from "./domains/buy-domain-dialog";
import { ChangeAddressDialog } from "./domains/change-address-dialog";
import { ConnectDomainDialog } from "./domains/connect-domain-dialog";
import { AddressIllustration } from "./domains/domain-illustration";
import { DomainsTable, type DomainRow } from "./domains/domains-table";
import { SettingsHeaderActions } from "./settings-header-slots";
import { useSettingsShop } from "./settings-shell";

/**
 * Settings → Domains: every address the shop answers at.
 *
 * Three things on the screen, in the order a merchant reads them. The header
 * carries the two ways of getting a domain — connect one you own, or buy one
 * — because that is what somebody arriving here wants to do. The table is the
 * state of every address, as a tree under the primary one. The card at the
 * bottom is the address the shop already has, and how to change its handle.
 *
 * A custom domain's setup is a page of its own (`/settings/domains/<id>`)
 * rather than a card under the table: the instructions are long, they belong
 * to one domain, and a merchant sends the link to whoever runs their DNS.
 *
 * "Buy new domain" opens a dialog rather than a checkout — the platform does
 * not sell domains — and it, the connect button and the whole flow are hidden
 * when the deployment cannot host a custom domain at all, so nobody is offered
 * a form whose instructions would be blank.
 */
export function DomainsPane() {
  const shop = useSettingsShop();
  const t = useTranslations("settings.domains");
  const router = useRouter();
  const params = useParams<{ shopSlug?: string }>();
  const shopSlug = params?.shopSlug ?? shop?.slug ?? null;
  const openWithPrompt = useAiChatStore((s) => s.openWithPrompt);

  const [connectOpen, setConnectOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(SHOP_DOMAINS, {
    skip: !shop,
  });

  const domains = (
    data as
      | {
          shopDomains?: {
            data?: DomainRow[];
            custom_domains_enabled?: boolean;
          };
        }
      | undefined
  )?.shopDomains;

  const rows = domains?.data ?? [];
  // Undefined until the list answers, so nothing flickers in and out.
  const enabled = domains?.custom_domains_enabled;
  // The reference design drops the promotional banner and the change-address
  // card once a custom domain exists: the merchant has done the thing both
  // cards exist to suggest, and the table is the screen.
  const hasCustom = rows.some((row) => row.kind === "CUSTOM");

  if (!shop) return null;

  const status = storefrontStatus(shop);

  // **Every "what is my address" answer on this screen comes from one place.**
  // The list is the authority: the server synthesises the platform row from its
  // own apex and omits it when there is none, so its presence answers whether
  // host mode is on and its hostname answers at what address. `NEXT_PUBLIC_
  // ROOT_DOMAIN` is a second copy of the same fact, set on a different
  // deployment by a different person, and reading it here is what let the
  // banner, the View links and the change-address card disagree with each other
  // on one screen.
  //
  // Until the list answers there is nothing to read, and only then does the env
  // value fill in — a placeholder, replaced rather than merged.
  const answered = domains !== undefined;
  const platformRoot = answered
    ? platformRootFrom(rows, shop.slug)
    : ROOT_DOMAIN;
  const platformAddress =
    rows.find((row) => row.kind === "PLATFORM_SUBDOMAIN")?.hostname ??
    handlePreview(shop.slug, STOREFRONT_HOST, platformRoot);
  const storefrontClosed = status !== "connected";
  const showBanner = storefrontClosed || (!hasCustom && !loading);
  const showChangeCard = !hasCustom && !loading;

  // The address keeps its own direction inside an Arabic sentence.
  const ltr = (chunks: React.ReactNode) => <span dir="ltr">{chunks}</span>;
  const banner =
    status === "pendingApproval"
      ? t("banner.pendingApproval")
      : status === "inactive"
        ? t("banner.inactive")
        : enabled === false
          ? t.rich("banner.disabled", { address: platformAddress, ltr })
          : t.rich("banner.body", { address: platformAddress, ltr });

  /**
   * The assistant is the closest thing this dashboard has to a help centre.
   * It used to be reached by closing this overlay — `openWithPrompt` then a
   * `router.push` to the dashboard home — because the panel is `absolute`
   * inside the content column and could not paint over a `fixed` overlay
   * mounted outside it. So asking for help about domains shut the domain
   * screen you were asking about. The panel now goes `fixed` while the overlay
   * is mounted, and this just opens it.
   */
  function learnMore() {
    openWithPrompt(t("learnMorePrompt"));
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeaderActions>
        {enabled && (
          <>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConnectOpen(true)}
              >
                {t("connect.action")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("connect.more")}
                    >
                      <ChevronDownIcon className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuItem onClick={() => setConnectOpen(true)}>
                    {t("connect.menu")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChangeOpen(true)}>
                    {t("change.menu")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
            <Button type="button" onClick={() => setBuyOpen(true)}>
              {t("buy.action")}
            </Button>
          </>
        )}
      </SettingsHeaderActions>

      {/* The banner explains the one case where a correctly configured
          address still shows nothing to customers — a storefront the platform
          has not approved or the merchant has switched off — and otherwise,
          before any custom domain exists, says what one is for. */}
      {showBanner && (
        <div className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
          >
            <InfoIcon className="size-5" />
          </span>
          <p className="min-w-0 pt-1.5 text-sm">
            {banner}{" "}
            <button
              type="button"
              onClick={learnMore}
              className="font-medium underline underline-offset-4 hover:text-foreground/80"
            >
              {t("learnMore")}
            </button>
          </p>
        </div>
      )}

      {error ? (
        // A failed list is said out loud, with a way to try again — an empty
        // table would read as "no domains", which is a different fact.
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm text-destructive">{t("list.loadError")}</p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            <RefreshCwIcon className="size-4" />
            {t("list.retry")}
          </Button>
        </div>
      ) : (
        <DomainsTable rows={rows} shopSlug={shop.slug} loading={loading} />
      )}

      {showChangeCard && (
      <section className="relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-col items-start gap-4 p-5 sm:pe-80">
          <div>
            <h2 className="font-heading text-base leading-snug font-medium">
              {platformRoot
                ? t("change.title", { root: platformRoot })
                : t("change.titlePath")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("change.body")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setChangeOpen(true)}
          >
            {platformRoot
              ? t("change.action", { root: platformRoot })
              : t("change.actionPath")}
          </Button>
        </div>
        <AddressIllustration
          prefix={platformRoot ? "" : `${STOREFRONT_HOST}/`}
          suffix={platformRoot ? `.${platformRoot}` : ""}
        />
      </section>
      )}

      <p className="text-center text-sm">
        <button
          type="button"
          onClick={learnMore}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("learnMore")}
        </button>
      </p>

      <ConnectDomainDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={(id) => router.push(domainUrl(shopSlug, id))}
      />
      <BuyDomainDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        onConnect={() => {
          setBuyOpen(false);
          setConnectOpen(true);
        }}
      />
      <ChangeAddressDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        shop={shop}
        platformRoot={platformRoot}
      />
    </div>
  );
}
