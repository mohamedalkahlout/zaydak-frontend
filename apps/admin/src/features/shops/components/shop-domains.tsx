"use client"

import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Table, TableBody } from "@repo/ui/components/table"

import {
  ShopDomainKind,
  ShopDomainStatus,
} from "@/shared/api/generated/graphql"
import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
} from "@/shared/components/data-table/data-table"
import { formatDate } from "@/shared/lib/format"

import { SHOP_DOMAINS } from "../api"
import {
  domainStatusVariant,
  shopStatus,
  statusBadgeVariant,
  type ShopDomainRow,
} from "../types"

const COLUMNS = 5

/**
 * Every address one shop answers at.
 *
 * **Read-only, and deliberately so.** A domain is the merchant's property and
 * its DNS lives in their registrar; an admin promoting, detaching or
 * re-verifying one would be changing where somebody else's shop answers, with
 * nothing on the merchant's own screen to say why it moved. The back-end offers
 * no admin mutation to pair with `adminShopDomains` either, so there is nothing
 * to wire even if the button existed. What an admin needs during a support
 * conversation is to *see* the state — which address is primary, whether the
 * last check failed, which DNS record the merchant still has not set — and that
 * is the whole of this screen.
 *
 * Reached from the row menu on `/shops`, so it wears no tab bar: there is one
 * view here, and a lone tab is chrome that says nothing.
 */
export function ShopDomains({ shopId }: { shopId: string }) {
  const t = useTranslations("shops")
  const locale = useLocale()

  const { data, loading, error } = useQuery(SHOP_DOMAINS, {
    variables: { shop_id: shopId },
    fetchPolicy: "cache-and-network",
  })

  const shop = data?.adminShopDomains.shop
  const rows = data?.adminShopDomains.data ?? []

  // The platform subdomain is synthesised by the back-end from the shop's
  // handle, so there is at most one and it is always first.
  const platform = rows.find(
    (row) => row.kind === ShopDomainKind.PlatformSubdomain,
  )

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/shops"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          {t("domains.back")}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">
            {shop?.name ?? t("domains.title")}
          </h1>
          {shop ? (
            <>
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                dir="ltr"
              >
                {shop.slug}
              </code>
              {/* The same helper the list uses, not a second reading of the
                  three flags — a shop that reads "Pending review" on /shops
                  must not read "Active" here. */}
              <Badge variant={statusBadgeVariant(shopStatus(shop))}>
                {t(`status.${shopStatus(shop)}`)}
              </Badge>
            </>
          ) : null}
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("domains.subtitle")}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      {/* Without a DNS target configured there is nothing to point a custom
          domain at, so the platform subdomain is the only address any shop on
          this deployment can ever have. Said here because an empty list would
          otherwise read as "this merchant has not connected one yet". */}
      {data && !data.adminShopDomains.custom_domains_enabled ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {t("domains.customDisabled")}
        </p>
      ) : null}

      <DataTableCard>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("domains.column.address")}</DataTableHead>
            <DataTableHead>{t("domains.column.kind")}</DataTableHead>
            <DataTableHead>{t("domains.column.status")}</DataTableHead>
            <DataTableHead>{t("domains.column.primary")}</DataTableHead>
            <DataTableHead>{t("domains.column.verified")}</DataTableHead>
          </DataTableHeader>
          <TableBody>
            {loading && !data ? (
              <DataTableSkeletonRows columns={COLUMNS} />
            ) : (
              rows.map((row) => (
                <DomainRow
                  key={row.id ?? row.hostname}
                  row={row}
                  locale={locale}
                />
              ))
            )}

            {!loading && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={COLUMNS}>
                {t("domains.empty")}
              </DataTableEmpty>
            ) : null}
          </TableBody>
        </Table>
      </DataTableCard>

      {/* The single most useful thing this screen says, and the one a reader
          will otherwise get wrong: the platform address has no DNS and no
          verification of its own — its status is derived from the shop's own
          two flags, so PENDING there is a statement about the shop, not about
          an address that needs setting up. */}
      {platform ? (
        <div className="max-w-prose space-y-2 text-sm text-muted-foreground">
          <p>{t("domains.platformNote")}</p>
          {platform.status === ShopDomainStatus.Pending ? (
            <p className="text-foreground">
              {t("domains.platformPendingNote")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DomainRow({ row, locale }: { row: ShopDomainRow; locale: string }) {
  const t = useTranslations("shops")
  const custom = row.kind === ShopDomainKind.Custom

  // What the merchant still has to set in their registrar. Hidden once the
  // address is serving, where it is a record that has already been read.
  const records =
    custom && row.status !== ShopDomainStatus.Active ? row.dns_records : []

  return (
    <DataTableRow>
      <DataTableCell>
        <span className="font-medium" dir="ltr">
          {row.hostname}
        </span>
        {records.length > 0 ? (
          <dl className="mt-2 space-y-1">
            <dt className="text-xs text-muted-foreground">
              {t("domains.dnsTitle")}
            </dt>
            {records.map((record) => (
              <dd
                key={`${record.type}:${record.name}`}
                className="font-mono text-xs text-muted-foreground"
                dir="ltr"
              >
                {record.type} {record.name} → {record.value}
              </dd>
            ))}
          </dl>
        ) : null}
      </DataTableCell>
      <DataTableCell className="text-muted-foreground">
        {custom ? t("domains.kind.custom") : t("domains.kind.platform")}
      </DataTableCell>
      <DataTableCell>
        <Badge variant={domainStatusVariant(row.status)}>
          {t(`domains.status.${row.status}`)}
        </Badge>
        {/* On an ACTIVE row this is not noise: the nightly sweep writes the
            failure and leaves the row serving, and the *next* failed check is
            what demotes it. An error against a serving address means it is one
            strike down. */}
        {row.last_error ? (
          <span className="mt-1 block text-xs text-destructive" dir="auto">
            {t("domains.lastError", { error: row.last_error })}
          </span>
        ) : null}
      </DataTableCell>
      <DataTableCell>
        {row.is_primary ? (
          <Badge variant="outline">{t("domains.primary")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </DataTableCell>
      <DataTableCell className="text-muted-foreground">
        {formatDate(row.verified_at, locale)}
      </DataTableCell>
    </DataTableRow>
  )
}
