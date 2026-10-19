"use client";

import { ChevronDownIcon, Repeat2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  formatRangeLabel,
  previousWindow,
  type DateRange,
} from "../lib/date-ranges";

/**
 * The compare-to-previous-period control. The back-end only supports a boolean
 * "compare against the immediately preceding equal window", so the menu maps
 * "No comparison" → off and "Previous period" → on. When on, the trigger shows
 * that previous window's dates (e.g. "Jun 7 – Jul 6, 2026"), matching Shopify's
 * comparison chip.
 */
export function AnalyticsComparison({
  compare,
  onCompareChange,
  effectiveRange,
}: {
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
  effectiveRange: DateRange;
}) {
  const t = useTranslations("analytics");
  const locale = useLocale();

  const label = compare
    ? formatRangeLabel(previousWindow(effectiveRange), locale)
    : t("comparison.none");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            className="tabular-nums"
            aria-label={t("comparison.aria")}
          >
            <Repeat2Icon className="size-4 text-muted-foreground" />
            {label}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup
          value={compare ? "previous" : "none"}
          onValueChange={(value) => onCompareChange(value === "previous")}
        >
          <DropdownMenuRadioItem value="none">
            {t("comparison.none")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="previous">
            {t("comparison.previous")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
