"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EyeIcon, GlobeIcon, Link2Icon, Trash2Icon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@/shared/lib/utils";

import { domainViewUrl } from "../../lib/domain-urls";
import { domainUrl, PLATFORM_DOMAIN_ID } from "../../lib/routes";
import { setupState, type DomainStatus } from "../../lib/domain-status";
import {
  ChangeDomainTypeDialog,
  domainTypeOf,
  type DomainTypeTarget,
} from "./change-domain-type-dialog";
import { DeleteDomainDialog } from "./delete-domain-dialog";
import { DomainStatusPill } from "./domain-status-pill";

export interface DomainRow {
  id?: string | null;
  hostname: string;
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM";
  status: DomainStatus;
  is_primary: boolean;
  /** Records the provider is still waiting on. Empty once serving. */
  dns_records?: readonly unknown[] | null;
}

/**
 * Every address the shop answers at, as a tree with the primary at its root.
 *
 * The shape is the information. A shop has exactly one primary address — the
 * one its links are built from — and every other address redirects to it, so
 * the others hang off it with a connector rather than sitting in a flat list
 * where the "Primary" pill is the only clue to how they relate. Promote a
 * custom domain and the tree re-roots under it, with the platform subdomain
 * now one of the branches, which is also exactly what happened.
 *
 * The platform subdomain and the merchant's own domains sit in the same list
 * because to the merchant they are the same kind of thing — an address
 * customers reach the shop at. What separates them is what can be *done* to
 * them, and it is **deletion alone**: the platform address is synthesised from
 * the shop's handle and has no row to delete, so `managed` (a real `id`) gates
 * that action and nothing else. Changing the address itself is the
 * store-address card below the table, a different flow because it moves the
 * route the dashboard is standing on.
 *
 * It used to gate *opening* and *promoting* too, which made the platform
 * address the one row on the screen that led nowhere and could not be handed
 * primacy back once a custom domain took it. Both are addressed by a sentinel
 * id (`PLATFORM_DOMAIN_ID`) rather than by a row: the detail route takes it,
 * and promoting that address is `clearPrimaryShopDomain`, which needs no id
 * because clearing every custom primary flag *is* promoting it.
 *
 * Row actions appear on hover and on focus, and always on a touch screen,
 * where there is no hover to reveal them.
 */
export function DomainsTable({
  rows,
  shopSlug,
  loading,
}: {
  rows: DomainRow[];
  shopSlug: string;
  /** First load only — a refetch keeps the rows it has. */
  loading?: boolean;
}) {
  const t = useTranslations("settings.domains.table");

  const [deleting, setDeleting] = useState<{
    id: string;
    hostname: string;
  } | null>(null);
  const [changing, setChanging] = useState<DomainTypeTarget | null>(null);

  const root = rows.find((row) => row.is_primary) ?? rows[0];
  const branches = rows.filter((row) => row !== root);

  const actions = {
    onDelete: (row: DomainRow) =>
      row.id && setDeleting({ id: row.id, hostname: row.hostname }),
    onChangeType: (row: DomainRow) =>
      setChanging({
        id: row.id ?? PLATFORM_DOMAIN_ID,
        hostname: row.hostname,
        kind: row.kind,
        status: row.status,
        is_primary: row.is_primary,
      }),
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(10.5rem,auto)] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span>{t("domain")}</span>
          <span>{t("status")}</span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="divide-y divide-border">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_minmax(10.5rem,auto)] items-center gap-3 px-4 py-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : root ? (
          <ul>
            <li>
              <DomainRowItem row={root} shopSlug={shopSlug} {...actions} />
              {branches.length > 0 && (
                <ul>
                  {branches.map((row) => (
                    <li
                      key={row.id ?? row.hostname}
                      // The connector: a line down from the root's icon and a
                      // tick into this row's, ending at the last branch.
                      className="relative before:absolute before:start-6 before:top-0 before:h-full before:w-px before:bg-border after:absolute after:start-6 after:top-1/2 after:h-px after:w-3 after:bg-border last:before:h-1/2"
                    >
                      <DomainRowItem
                        row={row}
                        shopSlug={shopSlug}
                        nested
                        {...actions}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        ) : null}
      </div>

      <DeleteDomainDialog
        domain={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
      <ChangeDomainTypeDialog
        domain={changing}
        currentType={changing ? domainTypeOf(changing, rows).type : "alias"}
        onOpenChange={(open) => !open && setChanging(null)}
      />
    </>
  );
}

function DomainRowItem({
  row,
  shopSlug,
  nested,
  onDelete,
  onChangeType,
}: {
  row: DomainRow;
  shopSlug: string;
  nested?: boolean;
  onDelete: (row: DomainRow) => void;
  onChangeType: (row: DomainRow) => void;
}) {
  const t = useTranslations("settings.domains");

  // No row behind it, so nothing to *delete* — see the table docblock. Opening
  // and promoting go through the sentinel instead.
  const managed = Boolean(row.id);
  const detailHref = domainUrl(shopSlug, row.id ?? PLATFORM_DOMAIN_ID);
  const viewHref = domainViewUrl(row, shopSlug);
  const Icon: LucideIcon = row.kind === "CUSTOM" ? Link2Icon : GlobeIcon;

  return (
    <div
      data-domain={row.hostname}
      className={cn(
        "group/domain relative grid grid-cols-[minmax(0,1fr)_minmax(10.5rem,auto)] items-center gap-3 border-t border-border px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/30",
        nested && "ps-10",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        {/* `dir="ltr"` because a hostname rendered right-to-left has its
            segments visually reversed, and the dashboard runs RTL in Arabic.
            The link is stretched over the whole row; the actions sit above it. */}
        {detailHref ? (
          <Link
            href={detailHref}
            dir="ltr"
            className="min-w-0 truncate text-sm font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
          >
            {row.hostname}
          </Link>
        ) : (
          <span dir="ltr" className="min-w-0 truncate text-sm font-medium">
            {row.hostname}
          </span>
        )}
        {row.is_primary && (
          <span className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {t("primary")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <DomainStatusPill state={setupState(row)} />

        <div className="relative z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/domain:opacity-100 group-hover/domain:opacity-100 [@media(hover:none)]:opacity-100">
          <RowAction
            icon={EyeIcon}
            label={t("table.view")}
            name={t("table.viewNamed", { hostname: row.hostname })}
            render={
              <a href={viewHref} target="_blank" rel="noopener noreferrer" />
            }
          />
          {/* The type dialog explains what can and cannot change for this
              address, so it opens for every row — including the platform one,
              which is where primacy is handed back. */}
          <RowAction
            icon={GlobeIcon}
            label={t("table.changeType")}
            name={t("table.changeTypeNamed", { hostname: row.hostname })}
            onClick={() => onChangeType(row)}
          />
          {managed && (
            <RowAction
              icon={Trash2Icon}
              label={t("table.remove")}
              name={t("table.removeNamed", { hostname: row.hostname })}
              destructive
              onClick={() => onDelete(row)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One icon action. `label` is the short tooltip; `name` is the accessible
 * name and carries the hostname, because three rows of "Delete domain" give a
 * screen-reader user no way to tell which address each button acts on.
 */
function RowAction({
  icon: Icon,
  label,
  name,
  destructive,
  render,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  name: string;
  destructive?: boolean;
  render?: React.ReactElement;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={name}
            onClick={onClick}
            nativeButton={!render}
            render={render}
            className={cn(
              "text-muted-foreground",
              destructive && "hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            <Icon className="size-4" />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
