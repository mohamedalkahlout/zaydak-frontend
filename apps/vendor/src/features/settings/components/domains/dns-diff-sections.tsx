"use client";

import { useTranslations } from "next-intl";
import type {
  ShopDnsDiffEntry,
  ShopDnsAction,
} from "@/shared/api/generated/graphql";
import { DnsDiffTable } from "./dns-diff-table";

export type DnsAction =
  | ShopDnsAction
  | "ADD"
  | "UPDATE"
  | "REMOVE"
  | "CORRECT";

export type DnsDiffEntry = ShopDnsDiffEntry;


/**
 * The DNS instructions, grouped by what the merchant has to *do*.
 *
 * **Grouping by action rather than by record is the whole design.** A flat list
 * of records with a status column asks the merchant to work out the verb for
 * each row; grouping does it for them, so the screen reads as a short list of
 * chores — remove two things, add one, change one — rather than a table to
 * study. That is the difference between a setup screen people finish and one
 * they abandon.
 *
 * **Empty sections are not rendered.** A "Remove these existing records"
 * heading over an empty table on a zone with nothing to remove reads as an
 * instruction the merchant has failed to follow, and on the common path — a
 * fresh domain where everything is an ADD — three of the four sections are
 * empty.
 *
 * The order is fixed: remove, then add, then update. Removing first is the one
 * that matters at a registrar, because a conflicting record left in place
 * makes an added one inert, and a merchant working top to bottom should not
 * have to discover that.
 *
 * Sections are numbered as steps, continuing from `startAt`, because on the
 * setup screen they follow "1. Log in to your DNS provider" — one numbered
 * list, not a heading and then a second list that starts again at one. They
 * render as `<li>`s for the same reason: the caller owns the `<ol>`.
 */
export function DnsDiffSections({
  diff,
  startAt = 1,
}: {
  diff: DnsDiffEntry[];
  /** The number the first rendered section takes. */
  startAt?: number;
}) {
  const t = useTranslations("settings.domains.diff");

  const of = (action: DnsAction) => diff.filter((e) => e.action === action);

  const groups = [
    { key: "remove" as const, entries: of("REMOVE") },
    { key: "add" as const, entries: of("ADD") },
    { key: "update" as const, entries: of("UPDATE") },
    { key: "correct" as const, entries: of("CORRECT") },
  ].filter((group) => group.entries.length > 0);

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group, index) => (
        <li key={group.key} className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            <span className="tabular-nums">{startAt + index}.</span>{" "}
            {t(group.key)}
          </p>
          <DnsDiffTable entries={group.entries} mode={group.key} />
        </li>
      ))}
    </>
  );
}
