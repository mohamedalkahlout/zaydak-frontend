import { useTranslations } from "next-intl";
import {
  AlertTriangleIcon,
  InfoIcon,
  OctagonAlertIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * The problems a zone has, drawn so the fatal one does not look like the maybe.
 *
 * **Every warning used to be the same amber box**, which said that a CAA record
 * forbidding every certificate authority and a caution that the merchant *may*
 * have left a proxy toggle on were the same news. A merchant reads the first
 * box and often stops, so the one that is certainly fatal has to look different
 * from the one that is a guess.
 *
 * The severity comes from the server (`ShopDnsWarning.severity`) rather than
 * being inferred from the sentence — inferring it would mean matching on
 * English text, which breaks the moment the sentence is translated.
 *
 * **And the sentence is translated here, keyed off `code`.** `message` is the
 * server's English and is the fallback, never the identity. The order of those
 * two matters in one direction only: this repo's `t()` renders a *missing* key
 * as the key, so a code with no catalogue entry would put the literal string
 * `DNS_CAA_BLOCKED` in front of a merchant — which is worse than an English
 * sentence they can at least act on. Hence `t.has()` first, always.
 *
 * `params` is spread in as the ICU values, so a code's parameter names are part
 * of its contract with the back-end: a catalogue entry naming `{required_value}`
 * only works while the code carrying it keeps emitting one. A parameter the
 * server did not send would throw inside `t()`, so the whole call is guarded and
 * falls back to the English rather than taking the page down over a sentence.
 *
 * The list is already ordered most-explanatory-first by the back-end and is
 * rendered in that order rather than re-sorted here: re-sorting by severity
 * would put a blocking CAA record above a proven proxy that is the *reason* the
 * CAA check reads as it does.
 */

export type DnsIssueSeverity = "ERROR" | "WARNING" | "INFO";

export interface DnsIssue {
  code: string;
  severity: DnsIssueSeverity;
  /** The server's English. Rendered only when the code has no local entry. */
  message: string;
  /** The specifics the localized sentence interpolates. */
  params?: Record<string, string> | null;
}

const TONE: Record<
  DnsIssueSeverity,
  { icon: LucideIcon; box: string; mark: string }
> = {
  // Red, and the only one that gets it: a merchant who sees red twice on one
  // screen learns that red means "something on this page", not "this is what
  // is broken".
  ERROR: {
    icon: OctagonAlertIcon,
    box: "bg-destructive/10 text-destructive dark:text-red-300",
    mark: "text-destructive dark:text-red-300",
  },
  WARNING: {
    icon: AlertTriangleIcon,
    box: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    mark: "text-amber-700 dark:text-amber-300",
  },
  // Neutral, deliberately. A catch-all resolver is context for why the checks
  // above read strangely, not something to act on — and an amber box would
  // have the merchant hunting for a record that is not theirs.
  INFO: {
    icon: InfoIcon,
    box: "bg-muted/60 text-muted-foreground",
    mark: "text-muted-foreground",
  },
};

export function DnsIssueList({
  issues,
  /** "Your domain is connected, but…" — shown only over a step already ticked. */
  intro,
}: {
  issues: readonly DnsIssue[];
  intro?: string;
}) {
  const t = useTranslations("settings.domains.dnsIssues");

  if (issues.length === 0) return null;

  /**
   * The merchant's own language when we have it, the server's English when we
   * do not — and never the raw code, which is what an unguarded `t()` renders.
   */
  function sentence(issue: DnsIssue): string {
    if (!t.has(issue.code)) return issue.message;
    try {
      return t(issue.code, issue.params ?? {});
    } catch {
      // A placeholder the server stopped sending. The English still reads.
      return issue.message;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {intro && <p className="text-sm font-medium">{intro}</p>}
      {issues.map((issue) => {
        const tone = TONE[issue.severity] ?? TONE.WARNING;
        const Icon = tone.icon;
        return (
          <div
            key={issue.code + issue.message}
            className={cn(
              "flex gap-2.5 rounded-lg p-3 text-sm",
              tone.box,
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", tone.mark)} />
            {/* `dir` is left to the page: these sentences carry hostnames and
                IP addresses, and the ones that do name them inside an ICU
                placeholder rather than as free text, so the paragraph's own
                direction is correct for both languages. */}
            <span className="min-w-0 text-pretty">{sentence(issue)}</span>
          </div>
        );
      })}
    </div>
  );
}
