"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { useFormatter, useTranslations } from "next-intl";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useAiChatStore } from "@/features/ai/store-chat";
import { GET_ME } from "@/features/auth/api/queries";

import {
  SHOP_DOMAINS,
  SHOP_DOMAIN_CONFIGURATION,
  VERIFY_SHOP_DOMAIN,
} from "../api/domains";
import {
  needsSetup,
  overallState,
  setupState,
  type DomainChecks,
} from "../lib/domain-status";
import { domainViewUrl } from "../lib/domain-urls";
import { sectionUrl } from "../lib/routes";
import {
  ChangeDomainTypeDialog,
  domainTypeOf,
  type DomainTypeTarget,
} from "./domains/change-domain-type-dialog";
import { DeleteDomainDialog } from "./domains/delete-domain-dialog";
import { DnsDiffSections, type DnsDiffEntry } from "./domains/dns-diff-sections";
import { DnsDiffTable } from "./domains/dns-diff-table";
import { DnsIssueList, type DnsIssue } from "./domains/dns-issue-list";
import { DomainHero, type HeroVariant } from "./domains/domain-hero";
import { DomainProviderMark } from "./domains/domain-provider-mark";
import { DomainStatusPill } from "./domains/domain-status-pill";
import { DomainSteps, type DomainStep } from "./domains/domain-steps";
import { DomainTargetCard } from "./domains/domain-target-card";
import {
  ResolverGrid,
  type ResolverReading,
} from "./domains/resolver-grid";
import type { DomainRow } from "./domains/domains-table";
import {
  SettingsHeaderActions,
  SettingsHeaderTitle,
} from "./settings-header-slots";
import { useSettingsShop } from "./settings-shell";

interface DomainEntry extends DomainRow {
  created_at?: string | null;
  verified_at?: string | null;
}

interface Configuration {
  zone_unreachable: boolean;
  /**
   * Each problem with a severity, a code and the specifics a translated
   * sentence needs. The deprecated `warnings` field says the same things with
   * all three thrown away and is deliberately not requested — two lists on one
   * screen is how they start disagreeing.
   */
  issues: DnsIssue[];
  propagation: {
    checked_at: string;
    agreement: string;
    resolvers: ResolverReading[];
  };
  domain: { id: string; hostname: string };
  dns_provider: {
    provider: string;
    display_name?: string | null;
    management_url?: string | null;
  };
  dns_diff: DnsDiffEntry[];
  checks: DomainChecks;
}

/**
 * One custom domain's setup screen, at `/settings/domains/<id>`.
 *
 * Reads the live configuration rather than the stored row, because the stored
 * row records what the provider said last time somebody pressed Verify — which
 * is exactly the wrong thing to show a merchant who has just changed their DNS
 * and come back to look. Everything under the hero is current as of the moment
 * it rendered; the stored row supplies only what does not move (the hostname,
 * when it was added) and, until the live reading arrives, the state pill.
 *
 * The screen has three looks, and one function decides which
 * (`setupState`): the records still have to be added (instructions open,
 * store and provider drawn over the globe); the records were checked and are
 * wrong (the same instructions under a red mark, the steps below it red);
 * and the domain is live or nearly so (a blue globe, the verified records as
 * a report with ticks, the certificate's progress). The verify button sits
 * between the first and second step, outside any fold, for as long as the
 * stored status is not ACTIVE — it is the only thing that advances it.
 */
export function DomainDetailPane({ domainId }: { domainId: string }) {
  const shop = useSettingsShop();
  const t = useTranslations("settings.domains");
  const format = useFormatter();
  const router = useRouter();
  const params = useParams<{ shopSlug?: string }>();
  const shopSlug = params?.shopSlug ?? shop?.slug ?? null;
  const openWithPrompt = useAiChatStore((s) => s.openWithPrompt);

  const { data: meData } = useQuery(GET_ME);
  const userName = (
    meData as { me?: { data?: { name?: string | null } | null } } | undefined
  )?.me?.data?.name;

  const { data: listData, loading: listLoading } = useQuery(SHOP_DOMAINS, {
    skip: !shop,
  });
  const rows =
    (listData as { shopDomains?: { data?: DomainEntry[] } } | undefined)
      ?.shopDomains?.data ?? [];
  const row = rows.find((entry) => entry.id === domainId);

  const {
    data: configData,
    loading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = useQuery(SHOP_DOMAIN_CONFIGURATION, {
    variables: { id: domainId },
    skip: !shop,
    // Always live. A cached answer on this screen is a merchant staring at
    // the state of their DNS from before they edited it.
    fetchPolicy: "network-only",
  });

  // What the last Verify returned, which is strictly newer than the query.
  //
  // **This is what stops one press costing two full inspections.** Apollo
  // cannot merge the mutation's answer into the query's on its own:
  // `ShopDomainConfiguration` has no `id`, so it never normalises, and every
  // field rendered here — the checks, the diff, the warnings — hangs off that
  // unnormalised wrapper. The obvious fix was `refetch()`, and it re-ran the
  // identical work: a provider probe, two resolver sweeps, a CAA climb and up
  // to three DNS-over-HTTPS lookups, all discarded except for rendering.
  // Keeping the answer instead costs one `useState`, keyed by `domainId` so a
  // different domain cannot show this one's result. `at` is when it was
  // taken — stamped in the handler, never during render.
  const [verified, setVerified] = useState<{
    id: string;
    config: Configuration;
    at: Date;
  } | null>(null);

  const [verify, { loading: verifying }] = useMutation(VERIFY_SHOP_DOMAIN, {
    variables: { id: domainId },
    // The stored status is what the list reads, and this mutation writes it —
    // so the list has to be refetched or the table disagrees with the steps.
    refetchQueries: [{ query: SHOP_DOMAINS }],
  });

  const queried = (
    configData as
      | { shopDomainConfiguration?: { data?: Configuration } }
      | undefined
  )?.shopDomainConfiguration?.data;
  const fromVerify = verified?.id === domainId ? verified : null;
  const config = fromVerify?.config ?? queried;

  const [deleting, setDeleting] = useState(false);
  const [changing, setChanging] = useState<DomainTypeTarget | null>(null);
  // Set the moment the row is deleted, so the refetch that empties the list
  // does not flash "no longer connected" before the navigation lands.
  const [left, setLeft] = useState(false);

  if (!shop) return null;

  const listUrl = sectionUrl(shopSlug, "domains");

  if (!row) {
    if (listLoading || left) {
      return (
        <SettingsHeaderTitle>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
        </SettingsHeaderTitle>
      );
    }
    return (
      <>
        <SettingsHeaderTitle>
          <h1 className="font-heading text-xl font-semibold">
            {t("detail.notFoundTitle")}
          </h1>
        </SettingsHeaderTitle>
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            {t("detail.notFoundBody")}
          </p>
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

  const provider = config?.dns_provider ?? null;
  const providerName = provider?.display_name ?? null;
  const checks = config?.checks ?? null;
  const state = setupState(row, checks);
  const connected = state === "CONNECTED";
  const viewUrl = domainViewUrl(row, shop.slug);
  const { type, redirectTarget } = domainTypeOf(row, rows);

  const heroVariant: HeroVariant =
    state === "NEEDS_SETUP"
      ? "setup"
      : state === "INVALID_DNS" || state === "ERROR"
        ? "error"
        : "live";

  // When the reading on screen was taken: the verify press, or for a domain
  // already serving, the stored time of its last successful check.
  const checkedAt =
    fromVerify?.at ??
    (row.status === "ACTIVE" && row.verified_at
      ? new Date(row.verified_at)
      : null);

  // A hostname keeps its own direction inside an RTL sentence, or a label
  // that starts with digits has its segments reordered.
  const ltr = (chunks: React.ReactNode) => <span dir="ltr">{chunks}</span>;

  async function check() {
    try {
      const { data: result } = await verify();
      const fresh = (
        result as { verifyShopDomain?: { data?: Configuration } } | undefined
      )?.verifyShopDomain?.data;

      if (fresh) setVerified({ id: domainId, config: fresh, at: new Date() });

      if (fresh && overallState(fresh.checks) === "connected") {
        sileo.success({
          title: t("steps.connected", { hostname: fresh.domain.hostname }),
        });
      } else {
        // Not an error. The merchant did nothing wrong and DNS is simply not
        // there yet — a red toast here reads as a failure they caused.
        sileo.info({
          title: t("steps.stillWaiting"),
          description: t("steps.propagationHint"),
        });
      }
    } catch (err) {
      sileo.error({ title: (err as Error).message });
    }
  }

  /**
   * Hand the domain to the assistant.
   *
   * It used to `router.push` to the dashboard home first, because the panel is
   * an `absolute` child of the content column and opened *behind* this overlay.
   * That closed the very instructions the merchant had just asked for help
   * with. The panel now lifts itself over the overlay on a settings URL (see
   * `SETTINGS_OVERLAY_PATH` in `ai-chat-panel`), so asking costs nothing —
   * queue the prompt and stay put.
   */
  function help() {
    openWithPrompt(t("hero.prompt", { hostname: row!.hostname }));
  }

  const steps = config ? buildSteps(config) : null;

  function buildSteps(cfg: Configuration): DomainStep[] {
    const c = cfg.checks;
    const dnsDone = c.dns_configured;
    // Wrong DNS that has been checked at least once. Before the first Verify
    // the same reading is "not set up yet", not a failure.
    const dnsFailed = !dnsDone && row!.status !== "PENDING";
    const live = c.dns_propagated && c.ownership_verified && c.routing_ready;
    const hasWarnings = cfg.issues.length > 0;

    const warningsBox = hasWarnings ? (
      // Real problems whose fix is the merchant's call, not ours — a CNAME at
      // the zone root, a proxying DNS provider. Kept out of the numbered steps
      // because those are steps to follow, and "delete this, which may be
      // your existing website" is not one.
      //
      // The intro only over a step that is already ticked: "your domain is
      // connected, but…" is wrong above a step that is failing.
      <DnsIssueList
        issues={cfg.issues}
        intro={dnsDone ? t("steps.issueIntro") : undefined}
      />
    ) : null;

    const verifiedRecords = cfg.dns_diff.filter((e) => e.action === "CORRECT");

    const instructions = (
      <>
        {warningsBox}
        <ol className="flex flex-col gap-5">
          <li className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              <span className="tabular-nums">1.</span>{" "}
              {providerName
                ? t.rich("steps.login", {
                    provider: providerName,
                    hostname: row!.hostname,
                    ltr,
                  })
                : t.rich("steps.loginUnknown", {
                    hostname: row!.hostname,
                    ltr,
                  })}
            </p>
            {providerName && provider && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <DomainProviderMark
                    provider={provider.provider}
                    name={providerName}
                  />
                  <span className="truncate text-sm font-medium">
                    {providerName}
                  </span>
                </div>
                {provider.management_url && (
                  <Button
                    type="button"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a
                        href={provider.management_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    {t("steps.loginAction")}
                  </Button>
                )}
              </div>
            )}
          </li>

          {/* Context for the records below, not a replacement for them.
              This used to render *instead of* the diff, which ended the
              screen on a domain whose owner could act on it right now: a
              registration is unreachable for its first hour or so while the
              registry publishes the delegation, and the records it needs are
              the same either way (the back-end reports them as ADDs with no
              current value). Unnumbered on purpose — it is not a chore, and
              the numbered steps below continue from 2. */}
          {cfg.zone_unreachable && (
            <li>
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                {t.rich("steps.zoneUnreachable", {
                  hostname: row!.hostname,
                  ltr,
                })}
              </p>
            </li>
          )}
          <DnsDiffSections diff={cfg.dns_diff} startAt={2} />
        </ol>
      </>
    );

    const report = (
      <>
        {warningsBox}
        {verifiedRecords.length > 0 && (
          <DnsDiffTable entries={verifiedRecords} mode="correct" />
        )}
      </>
    );

    // Outside the fold, on purpose. This is the only thing that advances the
    // stored status — the query reads DNS without writing anything — so it
    // has to be on screen on the return visit where the records are already
    // right, the first step is ticked and folded, and only propagation is
    // outstanding.
    //
    // **It is on screen for an ACTIVE domain too**, which it used to be gated
    // out of. Nobody presses Verify on a domain that works, so gating it on
    // "not yet ACTIVE" was defensible right up until one broke after
    // activation: the records changed, the live checks below went red, and the
    // only thing that could write the row back was the nightly sweep — two
    // strikes, up to two days — while the screen showed a green "Connected"
    // pill above a diff saying the record is missing. The merchant could see
    // the problem and had no button.
    //
    // The wording moves with it. "I updated DNS records" is a claim about
    // something the merchant just did, and on a domain they have not touched
    // in months it reads as a question they cannot answer.
    const recheck = !needsSetup(row!.status);
    const verifyButton = (
      <Button
        type="button"
        variant={recheck ? "outline" : "default"}
        onClick={() => void check()}
        disabled={verifying}
      >
        {verifying ? (
          t("steps.checking")
        ) : recheck ? (
          <>
            <RefreshCwIcon className="size-4" />
            {t("steps.recheck")}
          </>
        ) : (
          t("steps.iUpdated")
        )}
      </Button>
    );

    const dns: DomainStep = dnsDone
      ? {
          key: "dns",
          icon: "done",
          title: t("steps.dnsDone"),
          aside: hasWarnings ? (
            <span className="rounded-lg bg-neutral-200/80 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200">
              {t("steps.issue")}
            </span>
          ) : undefined,
          content:
            hasWarnings || verifiedRecords.length > 0 ? report : undefined,
          // A warning is never hidden behind a fold by default — it is the
          // one thing on a "done" step the merchant has to read.
          defaultOpen: hasWarnings,
          toggle: "chevron",
          after: verifyButton,
        }
      : {
          key: "dns",
          icon: dnsFailed ? "error" : "pending",
          title: dnsFailed
            ? providerName
              ? t("steps.dnsNotDetected", { provider: providerName })
              : t("steps.dnsNotDetectedUnknown")
            : providerName
              ? t("steps.configure", { provider: providerName })
              : t("steps.configureUnknown"),
          subtitle: dnsFailed ? t("steps.dnsNotDetectedHint") : undefined,
          content: instructions,
          defaultOpen: true,
          toggle: "panel",
          after: verifyButton,
        };

    // Which resolvers were asked and what each said — the evidence behind the
    // verdict in the step's title. Folded away once the domain is live (there
    // is nothing to diagnose) and open while it is not, which is the only time
    // "why does it work for me and not for my customer" gets asked.
    const grid = (
      <ResolverGrid
        resolvers={cfg.propagation.resolvers}
        checkedAt={format.dateTime(new Date(cfg.propagation.checked_at), {
          timeStyle: "short",
        })}
      />
    );

    const liveStep: DomainStep = live
      ? {
          key: "live",
          icon: "done",
          title: t("steps.liveDone"),
          subtitle: checkedAt
            ? t("steps.lastChecked", {
                time: format.dateTime(checkedAt, { timeStyle: "short" }),
              })
            : undefined,
          content: grid,
          defaultOpen: false,
          toggle: "chevron",
        }
      : dnsFailed
        ? {
            key: "live",
            icon: "error",
            title: t("steps.notLive"),
            subtitle: t("steps.notLiveHint"),
            content: grid,
            defaultOpen: false,
            toggle: "chevron",
          }
        : {
            key: "live",
            icon: dnsDone ? "progress" : "pending",
            title: t("steps.live"),
            // Which of the platform's three checks is the one in progress —
            // the answer to "what is it waiting on", without a row each.
            subtitle: dnsDone
              ? !c.dns_propagated
                ? t("steps.waitPropagation")
                : !c.ownership_verified
                  ? t("steps.waitOwnership")
                  : t("steps.waitRouting")
              : undefined,
            content: grid,
            // Open exactly when propagation is the thing being waited on: that
            // is the one state where naming the resolver that is behind is an
            // answer rather than trivia.
            defaultOpen: dnsDone && !c.dns_propagated,
            toggle: "chevron",
          };

    const tls: DomainStep =
      c.tls === "READY"
        ? { key: "tls", icon: "done", title: t("steps.tlsReady") }
        : c.tls === "FAILED"
          ? { key: "tls", icon: "error", title: t("steps.tlsFailed") }
          : c.tls === "PROVISIONING"
            ? {
                key: "tls",
                icon: "progress",
                title: t("steps.tlsProvisioning"),
                subtitle: t("steps.tlsRequesting"),
                aside: t("steps.tlsEstimate"),
              }
            : { key: "tls", icon: "pending", title: t("steps.tlsPending") };

    return [dns, liveStep, tls];
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeaderTitle>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* `dir="ltr"` because a hostname rendered right-to-left has its
                segments visually reversed, and the dashboard runs RTL in Arabic. */}
            <h1
              dir="ltr"
              className="min-w-0 truncate font-heading text-xl font-semibold"
            >
              {row.hostname}
            </h1>
            <DomainStatusPill state={state} />
          </div>
          {/* One line that truncates rather than wraps, so the three actions
              beside it never push the date under the provider. A div, not a
              p: the skeleton it holds while the provider loads is a block. */}
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {config ? (
              <span>
                {providerName
                  ? t("detail.managedBy", { provider: providerName })
                  : t("detail.managedByUnknown")}
              </span>
            ) : configError ? null : (
              <Skeleton className="inline-block h-4 w-36 align-middle" />
            )}
            {row.created_at && (
              <>
                {config && <span aria-hidden> · </span>}
                <span>
                  {t("detail.addedOn", {
                    date: format.dateTime(new Date(row.created_at), {
                      dateStyle: "medium",
                    }),
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </SettingsHeaderTitle>

      <SettingsHeaderActions>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" />
          }
        >
          {t("detail.view")}
        </Button>
        {providerName && provider?.management_url && (
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={provider.management_url}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLinkIcon className="size-4" />
            {t("detail.login", { provider: providerName })}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline">
                {t("detail.settings")}
                <ChevronDownIcon className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon className="size-4" />
              {t("detail.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingsHeaderActions>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <DomainHero
          hostname={row.hostname}
          variant={heroVariant}
          connected={connected}
          shop={shop}
          provider={provider}
          userName={userName}
          onHelp={help}
        />

        <div className="p-5">
          {steps ? (
            <DomainSteps steps={steps} />
          ) : configError ? (
            // A failed reading is said out loud, with a way to try again — an
            // empty card would read as "nothing to do", which is a different
            // fact.
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">
                {t("steps.loadError")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetchConfig()}
              >
                <RefreshCwIcon className="size-4" />
                {t("steps.retry")}
              </Button>
            </div>
          ) : configLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-56" />
            </div>
          ) : null}
        </div>
      </section>

      <DomainTargetCard
        type={type}
        redirectTarget={redirectTarget}
        onChange={() =>
          setChanging({
            id: domainId,
            hostname: row.hostname,
            kind: row.kind,
            status: row.status,
            is_primary: row.is_primary,
          })
        }
      />

      <DeleteDomainDialog
        domain={deleting ? { id: domainId, hostname: row.hostname } : null}
        onOpenChange={(open) => !open && setDeleting(false)}
        onDeleted={() => {
          setLeft(true);
          router.replace(listUrl);
        }}
      />
      <ChangeDomainTypeDialog
        domain={changing}
        currentType={type}
        onOpenChange={(open) => !open && setChanging(null)}
      />
    </div>
  );
}
