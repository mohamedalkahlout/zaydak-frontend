"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib/utils";

import {
  TONE_CLASS,
  setupTone,
  type SetupState,
} from "../../lib/domain-status";

/**
 * The one-phrase state of an address: "Connected", "Needs setup", "Invalid
 * DNS", "Provisioning TLS", "Error". The same pill in the table and beside the
 * detail screen's heading, fed by the same `setupState()`, so a merchant who
 * reads one and then the other never sees them disagree.
 */
export function DomainStatusPill({
  state,
  className,
}: {
  state: SetupState;
  className?: string;
}) {
  const t = useTranslations("settings.domains.status");
  return (
    <span
      data-state={state}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-lg px-2 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[setupTone(state)],
        className,
      )}
    >
      {t(state)}
    </span>
  );
}
