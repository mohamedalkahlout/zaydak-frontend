import { useTranslations } from "next-intl";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * What each public resolver said, under the "Domain is live" step.
 *
 * **The checklist gives a verdict; this is the evidence.** A merchant told only
 * that "the DNS has not propagated" has been handed a yes/no where the useful
 * answer is which resolver is behind — and while they wait, they cannot tell a
 * zone that is mid-flight from one that is wrong.
 *
 * Three states, not two, and keeping them apart is the whole point. A resolver
 * that timed out has not disagreed about anything — it said nothing — and a
 * grid that paints silence the same colour as a conflict tells a merchant their
 * records are inconsistent when what actually happened is that we could not
 * reach 8.8.8.8 for four seconds. The advice for the two is opposite: wait,
 * versus nothing to do. So `agrees == null` draws a dash and never a cross.
 */

export interface ResolverReading {
  key: string;
  name: string;
  responded: boolean;
  agrees?: boolean | null;
}

export function ResolverGrid({
  resolvers,
  checkedAt,
}: {
  resolvers: readonly ResolverReading[];
  /** Rendered by the caller, which owns the locale's time format. */
  checkedAt?: string | null;
}) {
  const t = useTranslations("settings.domains.resolvers");

  if (resolvers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        {checkedAt && (
          <p className="text-xs text-muted-foreground">
            {t("checkedAt", { time: checkedAt })}
          </p>
        )}
      </div>

      <ul className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
        {resolvers.map((resolver) => {
          const state = !resolver.responded
            ? "silent"
            : resolver.agrees == null
              ? "unknown"
              : resolver.agrees
                ? "agrees"
                : "differs";

          const Icon =
            state === "agrees"
              ? CheckIcon
              : state === "differs"
                ? XIcon
                : MinusIcon;

          return (
            <li
              key={resolver.key}
              className="flex items-center gap-2.5 bg-card px-3 py-2.5"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  state === "agrees" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                  state === "differs" &&
                    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
                  (state === "silent" || state === "unknown") &&
                    "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="min-w-0">
                {/* `dir="ltr"` because the name carries an IP address, whose
                    segments read reversed under an Arabic paragraph. */}
                <p dir="ltr" className="truncate text-sm">
                  {resolver.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t(state)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
