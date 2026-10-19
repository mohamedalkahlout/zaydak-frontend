"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@/shared/lib/utils";

import type { DnsDiffEntry } from "./dns-diff-sections";

export type DnsDiffTableMode = "remove" | "add" | "update" | "correct";

/**
 * Read a side of an entry as the list it is.
 *
 * **Falls back to the deprecated scalar**, so the component stays correct
 * against a back-end older than itself — during a deploy window a stale API
 * answers with the scalars alone, and rendering one value is degraded rather
 * than blank. The fallback is deliberately not a reason to skip the selection
 * set: a forgotten field there is `undefined` here, with a green typecheck and
 * a green build, and this would quietly hide it. The fragment test is what
 * catches that.
 */
function currentOf(entry: DnsDiffEntry): string[] {
  if (entry.current_values?.length) return entry.current_values;
  return entry.current_value ? [entry.current_value] : [];
}

function requiredOf(entry: DnsDiffEntry): string[] {
  if (entry.required_values?.length) return entry.required_values;
  return entry.required_value ? [entry.required_value] : [];
}

/**
 * One table of DNS records, shaped by what the merchant is meant to do with
 * them.
 *
 * `remove` shows what the zone holds today and nothing else — there is
 * nothing to copy into a new record, and a "required" column would suggest
 * these should be edited rather than deleted. `add` and `update` are the
 * before-and-after shape: what the registrar's editor shows now, an arrow,
 * and what it has to say. For an add the "now" is `(empty)`, which is worth
 * printing rather than leaving blank because it is the row's whole point: this
 * record does not exist yet. `correct` is a record already in place and
 * verified, with a tick beside it — the report a merchant reads once the
 * domain is live.
 *
 * **Every required value is copyable, and that is the feature.** They are
 * typed into somebody else's DNS editor, in another tab, from memory — and one
 * wrong character produces a domain that never verifies with no error anywhere
 * saying which field was wrong. A value the merchant is told to delete gets no
 * copy button: there is nothing useful to paste, and offering one invites
 * pasting back the record they were just told to remove.
 *
 * The `name` column shows the **label alone** (`@`, `www`) because that is
 * what a registrar's editor expects; every one of them appends the zone
 * itself, so a merchant who pastes `www.example.com` into GoDaddy creates
 * `www.example.com.example.com` and reports that our instructions do not work.
 *
 * `dir="ltr"` on every value is not cosmetic. The dashboard runs right-to-left
 * in Arabic, and a hostname or an IP rendered RTL has its segments visually
 * reordered — `1.2.3.4` reads as `4.3.2.1`. Copying still yields the right
 * string, which makes it worse: the merchant reads one thing, pastes another,
 * and has no reason to suspect the page.
 *
 * **Under each row sits the sentence saying why it is there** — see `noteOf`.
 * Without it the table asks a merchant to delete a record from someone else's
 * zone and gives no reason anywhere on the page for doing so.
 */
export function DnsDiffTable({
  entries,
  mode,
}: {
  entries: DnsDiffEntry[];
  mode: DnsDiffTableMode;
}) {
  const t = useTranslations("settings.domains.dns");

  if (entries.length === 0) return null;

  const beforeAfter = mode === "add" || mode === "update";

  /**
   * The sentence printed under a row.
   *
   * **The back-end writes one per entry and nothing rendered it.** `reason` is
   * the whole explanation of why a record has to change — a CNAME that cannot
   * coexist with its neighbours, an AAAA quietly taking the half of visitors
   * who have IPv6 to whoever hosted the site before — and the screen showed
   * only the section heading, so "Remove these existing records" was an
   * instruction to edit somebody's live zone with no reason given anywhere.
   *
   * The two whole-set sentences win over it where they apply, in the order
   * `dns-issue-list` prefers a catalogue entry to the server's `message`:
   * those are translated and `reason` is not, and on a multi-value row the two
   * say the same thing almost word for word.
   *
   * `correct` is the exception and gets no note at all. Nobody is being asked
   * to edit those rows, and "Already pointing here." repeated under every
   * verified record doubles the height of the report to say what the tick
   * beside it already says.
   */
  function noteOf(entry: DnsDiffEntry): string | null {
    if (mode === "correct") return null;

    // Two shapes, two sentences. Several current values is a statement about
    // the merchant's zone; one current value against several required ones is
    // not, and using the first sentence there told them their name "answers
    // with more than one value today" directly above a row showing exactly one.
    if (currentOf(entry).length > 1) return t("replacesWholeSet");
    if (requiredOf(entry).length > 1) return t("requiresWholeSet");

    // Empty against a back-end that predates the field, which is a row with no
    // note rather than an empty one.
    return entry.reason || null;
  }

  // Type, name, value — plus the arrow and the required value on a
  // before-and-after table, or the tick on a verified one. Derived once, so
  // the note row's `colSpan` cannot drift from the header it sits under.
  const columns = 3 + (beforeAfter ? 2 : 0) + (mode === "correct" ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="px-3 py-2.5 text-start font-medium">{t("type")}</th>
            <th className="px-3 py-2.5 text-start font-medium">{t("name")}</th>
            {/* Picked by what the rows actually hold rather than by mode. The
                plural used to sit over the one column that always prints
                `(empty)`, and never over the column that can now carry several
                values. */}
            <th className="px-3 py-2.5 text-start font-medium">
              {mode === "correct"
                ? t("value")
                : entries.some((entry) => currentOf(entry).length > 1)
                  ? t("currentValues")
                  : t("currentValue")}
            </th>
            {beforeAfter && (
              <>
                <th className="w-10 px-1 py-2.5" aria-hidden />
                <th className="px-3 py-2.5 text-start font-medium">
                  {t("updateTo")}
                </th>
              </>
            )}
            {mode === "correct" && <th className="w-10 px-3 py-2.5" aria-hidden />}
          </tr>
        </thead>
        <tbody>
          {entries.flatMap((entry, index) => [
            <tr
              key={`${entry.type}-${entry.name}-${index}`}
              className="group/dns-row border-t border-border"
            >
              {/* Direction goes on the value, never on the cell: a `<td
                  dir="ltr">` under an RTL page resolves `text-align: start`
                  to the left while the header above it resolves to the right,
                  and every column reads as two misaligned stacks. */}
              <td className="px-3 py-3 align-top font-medium">
                <span dir="ltr">{entry.type}</span>
              </td>
              <td className="px-3 py-3 align-top">
                <span dir="ltr">{entry.name}</span>
              </td>
              <td className="max-w-[18rem] px-3 py-3 align-top">
                {mode === "add" ? (
                  <span className="text-muted-foreground">{t("empty")}</span>
                ) : (
                  // A stack, because a name can answer with several values and
                  // they are one instruction. `dir` and the struck-through
                  // styling stay on each value: on the wrapper, the strike
                  // would run through the gaps between them, and the direction
                  // would apply to a box rather than to a string.
                  <span className="flex flex-col gap-1">
                    {(mode === "correct"
                      ? requiredOf(entry)
                      : currentOf(entry)
                    ).map((value, valueIndex) => (
                      <span
                        key={`${value}-${valueIndex}`}
                        dir="ltr"
                        className={cn(
                          "block truncate",
                          mode === "remove" &&
                            "text-muted-foreground line-through",
                          mode === "update" && "text-muted-foreground",
                        )}
                      >
                        {value}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              {beforeAfter && (
                <>
                  <td className="px-1 py-3 align-top text-muted-foreground">
                    <ArrowRightIcon
                      aria-hidden
                      className="mx-auto size-4 rtl:rotate-180"
                    />
                  </td>
                  <td className="max-w-[18rem] px-3 py-3 align-top">
                    {/* One copy button per value, never one copying the set
                        joined together: no registrar accepts several values in
                        one Value field, so a joined clipboard is never correct
                        to paste anywhere. */}
                    <span className="flex flex-col gap-1">
                      {requiredOf(entry).map((value, valueIndex) => (
                        <span
                          key={`${value}-${valueIndex}`}
                          className="flex items-center gap-1.5"
                        >
                          <span dir="ltr" className="block truncate font-medium">
                            {value}
                          </span>
                          <CopyButton value={value} />
                        </span>
                      ))}
                    </span>
                  </td>
                </>
              )}
              {mode === "correct" && (
                <td className="px-3 py-3 align-top">
                  <CheckIcon
                    aria-label={t("verified")}
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                  />
                </td>
              )}
            </tr>,
            // Said under the row it applies to, rather than as a fifth
            // section — a new section means a new action value, and a client
            // that has not learned it drops the entries silently and renders
            // an empty instruction list.
            noteOf(entry) ? (
              <tr
                key={`${entry.type}-${entry.name}-${index}-note`}
                className="border-0"
              >
                <td colSpan={columns} className="px-3 pb-3">
                  {/* On the sentence, never on the cell — the same rule the
                      value columns follow. `auto` rather than a fixed
                      direction because this one line carries either a
                      translated sentence or the server's English `reason`, and
                      neither `ltr` nor the page's own direction is right for
                      both; the browser reads the first strong character and
                      gets each of them right. */}
                  <span
                    dir="auto"
                    className="block text-xs text-pretty text-muted-foreground"
                  >
                    {noteOf(entry)}
                  </span>
                </td>
              </tr>
            ) : null,
          ])}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Copy one value, and say so.
 *
 * The confirmation is the whole point — without it a merchant cannot tell a
 * click that worked from one that missed, and the usual response is to click
 * again and paste twice. Two seconds is long enough to read and short enough
 * that the button is ready again by the time they come back from the other tab.
 */
function CopyButton({ value }: { value: string }) {
  const t = useTranslations("settings.domains.dns");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // `navigator.clipboard` is unavailable over plain HTTP and in some
      // embedded browsers. Silence is right here: the value is on screen and
      // selectable, so the merchant can still copy it by hand — and an error
      // toast about a convenience would read as the setup having failed.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={() => void copy()}
      aria-label={copied ? t("copied") : t("copy")}
      className="shrink-0 opacity-0 transition-opacity group-hover/dns-row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-600" />
      ) : (
        <CopyIcon className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}
