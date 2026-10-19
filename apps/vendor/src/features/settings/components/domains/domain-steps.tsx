"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@/shared/lib/utils";

export type StepIcon = "pending" | "done" | "error" | "progress";

export interface DomainStep {
  key: string;
  icon: StepIcon;
  title: string;
  subtitle?: string;
  /** The right-hand slot: a badge, an estimate. */
  aside?: React.ReactNode;
  /** Foldable detail under the row, with a toggle at the end of the title line. */
  content?: React.ReactNode;
  defaultOpen?: boolean;
  /** The toggle's glyph: a panel for instructions, a chevron for a report. */
  toggle?: "panel" | "chevron";
  /** Rendered after the row and *outside* the fold — the verify button. */
  after?: React.ReactNode;
}

/**
 * The setup of a domain as the steps it goes through, in the order they
 * complete.
 *
 * Three rows rather than the five checks the server reports, because a
 * merchant reads them as a story — fix the records, wait for the domain to
 * come live, wait for the certificate — and the two checks between "live" and
 * "not live" (ownership, routing) are the platform's work, named in the row's
 * subtitle while they are the thing in progress rather than given rows of
 * their own. What the separation exists for survives: the merchant can always
 * tell "I have finished and the platform is working" from "something is
 * wrong", because those are different icons on different rows.
 *
 * The icon states are the whole vocabulary: dashed circle for not started,
 * green tick for done, red alert for wrong, a spinner for in progress. A row
 * with detail folds it under the title; the first row's instructions open by
 * default while they are needed and fold once the records are right. Anything
 * passed as `after` — the verify button — sits *between* rows, outside the
 * fold, so it cannot disappear with a step that is already ticked.
 */
export function DomainSteps({ steps }: { steps: DomainStep[] }) {
  const current = steps.findIndex((step) => step.icon !== "done");

  return (
    <ol className="flex flex-col gap-5">
      {steps.map((step, index) => (
        <StepRow
          key={step.key}
          step={step}
          current={index === current}
          muted={step.icon === "pending" && index !== current}
        />
      ))}
    </ol>
  );
}

function StepRow({
  step,
  current,
  muted,
}: {
  step: DomainStep;
  current: boolean;
  muted: boolean;
}) {
  const t = useTranslations("settings.domains.steps");
  const [open, setOpen] = useState(step.defaultOpen ?? false);
  const foldable = Boolean(step.content);

  return (
    <li
      data-step={step.key}
      data-icon={step.icon}
      className="flex flex-col gap-4"
      aria-current={current ? "step" : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon kind={step.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-6",
                  muted ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.title}
              </p>
              {step.subtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {step.subtitle}
                </p>
              )}
            </div>
            {step.aside && (
              <div className="shrink-0 pt-0.5 text-sm text-muted-foreground">
                {step.aside}
              </div>
            )}
            {foldable && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={open ? t("collapse") : t("expand")}
                className="-me-1.5 shrink-0 text-muted-foreground"
              >
                <Toggle kind={step.toggle ?? "chevron"} open={open} />
              </Button>
            )}
          </div>
          {foldable && open && (
            <div className="mt-4 flex flex-col gap-5">{step.content}</div>
          )}
        </div>
      </div>
      {step.after && <div className="flex justify-end">{step.after}</div>}
    </li>
  );
}

function Icon({ kind }: { kind: StepIcon }) {
  const base = "mt-0.5 size-5 shrink-0";
  switch (kind) {
    case "done":
      return (
        <CircleCheckIcon
          aria-hidden
          className={cn(base, "text-emerald-600 dark:text-emerald-400")}
        />
      );
    case "error":
      return (
        <CircleAlertIcon aria-hidden className={cn(base, "text-destructive")} />
      );
    case "progress":
      return (
        <LoaderCircleIcon
          aria-hidden
          className={cn(base, "animate-spin text-muted-foreground")}
        />
      );
    default:
      return (
        <CircleDashedIcon
          aria-hidden
          className={cn(base, "text-muted-foreground")}
        />
      );
  }
}

function Toggle({ kind, open }: { kind: "panel" | "chevron"; open: boolean }) {
  if (kind === "panel") {
    return open ? (
      <PanelRightCloseIcon className="size-4 rtl:-scale-x-100" />
    ) : (
      <PanelRightOpenIcon className="size-4 rtl:-scale-x-100" />
    );
  }
  return open ? (
    <ChevronUpIcon className="size-4" />
  ) : (
    <ChevronDownIcon className="size-4" />
  );
}
