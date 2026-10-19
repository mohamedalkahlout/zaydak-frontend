"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { GlobeIcon, InfoIcon, Link2Icon, StoreIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import type { DomainType } from "./change-domain-type-dialog";

/**
 * "Domain target and type" — what this address does.
 *
 * Two rows, and only the second can change. The target is the online store
 * for every address a shop has, because the platform serves nothing else at a
 * domain; it is still shown, because the question "where does this go?" is
 * the one a merchant looking at a new domain asks first. The type is read
 * from the whole list rather than from `is_primary` alone: an address
 * redirects only when a *custom* domain is primary and live, and otherwise
 * serves the store on its own. Change opens the type dialog.
 */
export function DomainTargetCard({
  type,
  redirectTarget,
  onChange,
}: {
  type: DomainType;
  /** Where a redirecting address sends visitors. */
  redirectTarget: string | null;
  onChange: () => void;
}) {
  const t = useTranslations("settings.domains.target");
  // The tooltip is for a pointer; assistive tech reads the same sentence
  // through the button's description, which a hover popup never provides.
  const infoId = useId();

  const TypeIcon = type === "primary" ? GlobeIcon : Link2Icon;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="font-heading text-base leading-snug font-medium">
          {t("title")}
        </h2>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("infoLabel")}
                aria-describedby={infoId}
                className="grid size-5 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            }
          >
            <InfoIcon className="size-4" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-pretty">
            {t("info")}
          </TooltipContent>
        </Tooltip>
        <p id={infoId} className="sr-only">
          {t("info")}
        </p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <StoreIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("target")}</p>
            <p className="text-sm">{t("onlineStore")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <TypeIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{t("type")}</p>
            <p className="text-sm">
              {type === "primary"
                ? t("primary")
                : type === "redirect" && redirectTarget
                  ? t.rich("redirects", {
                      hostname: redirectTarget,
                      // The hostname keeps its own direction inside an RTL
                      // sentence, or its segments read reversed.
                      ltr: (chunks) => <span dir="ltr">{chunks}</span>,
                    })
                  : t("alias")}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onChange}>
            {t("change")}
          </Button>
        </div>
      </div>
    </section>
  );
}
