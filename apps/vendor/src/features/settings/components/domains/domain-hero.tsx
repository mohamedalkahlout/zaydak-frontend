"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRightIcon, SparklesIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import AppImage from "@/shared/components/app-image";
import { cn } from "@/shared/lib/utils";

import { DomainProviderMark } from "./domain-provider-mark";

export type HeroVariant = "setup" | "error" | "live";

/**
 * The picture at the top of a domain's setup screen, and the offer of help
 * under it.
 *
 * The picture says what the screen is about before a word is read, and it
 * changes with the domain's state. While the records still have to be added
 * it shows the store, the company holding the DNS, and the link being made
 * between them over the world the domain has to propagate across (no second
 * circle when the DNS provider could not be detected — an unnamed one would
 * be a question mark the merchant cannot answer). Once DNS was checked and
 * is wrong, the world carries one red mark. Once the domain is live, the
 * world turns blue and the circles are gone: there is nothing left to link.
 *
 * The bar is the assistant's. "Help set up domain" hands the domain to the
 * store's AI agent with a prompt that names it, which is the one thing on this
 * screen that can answer a follow-up question rather than restate the
 * instructions.
 */
export function DomainHero({
  hostname,
  variant,
  connected,
  shop,
  provider,
  userName,
  onHelp,
}: {
  hostname: string;
  variant: HeroVariant;
  connected: boolean;
  shop: { name: string; logo?: { thumbnail: string } | null };
  provider: { provider: string; display_name?: string | null } | null;
  userName?: string | null;
  onHelp: () => void;
}) {
  const t = useTranslations("settings.domains.hero");
  const firstName = userName?.trim().split(/\s+/)[0] || null;

  return (
    <div
      data-variant={variant}
      className={cn(
        "relative h-60 overflow-hidden rounded-t-xl",
        variant === "live"
          ? "bg-[radial-gradient(ellipse_at_50%_120%,var(--color-sky-100)_0%,transparent_65%)] dark:bg-[radial-gradient(ellipse_at_50%_120%,var(--color-sky-950)_0%,transparent_65%)]"
          : "bg-[radial-gradient(ellipse_at_50%_120%,var(--color-violet-100)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_120%,var(--color-violet-950)_0%,transparent_60%)]",
      )}
    >
      <GlobeArt blue={variant === "live"} />

      {variant === "setup" && (
        <div className="absolute inset-x-0 top-9 flex items-center justify-center gap-5">
          <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-emerald-500 text-lg font-semibold text-white ring-4 ring-card shadow-md">
            {shop.logo?.thumbnail ? (
              <AppImage
                src={shop.logo.thumbnail}
                alt=""
                width={64}
                height={64}
                className="size-full object-cover"
              />
            ) : (
              initialsOf(shop.name)
            )}
          </span>
          {provider?.display_name && (
            <>
              <ArrowLeftRightIcon
                aria-hidden
                className="size-6 text-muted-foreground"
              />
              <span className="grid size-16 place-items-center rounded-full bg-card ring-4 ring-card shadow-md">
                <DomainProviderMark
                  provider={provider.provider}
                  name={provider.display_name}
                  className="size-11 rounded-full text-xl"
                />
              </span>
            </>
          )}
        </div>
      )}

      {variant === "error" && (
        <div className="absolute inset-x-0 top-11 flex justify-center">
          <span
            aria-hidden
            className="grid size-16 place-items-center rounded-full bg-red-600 text-3xl font-bold text-white ring-4 ring-red-200 shadow-md dark:ring-red-900"
          >
            !
          </span>
        </div>
      )}

      <div className="absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.3)] ring-1 ring-foreground/10">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
        >
          <SparklesIcon className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          {connected
            ? t.rich("connected", {
                hostname,
                ltr: (chunks) => <span dir="ltr">{chunks}</span>,
              })
            : firstName
              ? t("greeting", { name: firstName })
              : t("greetingAnon")}
        </p>
        <Button type="button" variant="outline" onClick={onHelp}>
          {t("help")}
        </Button>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S"
  );
}

/**
 * The top of a globe, rising into the frame from below. Decorative — the
 * continents are shapes, not a map — so it is hidden from assistive tech.
 */
function GlobeArt({ blue }: { blue: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 420 200"
      className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-44 w-[26rem] max-w-full"
    >
      <circle
        cx="210"
        cy="230"
        r="200"
        className={blue ? "fill-sky-200/70 dark:fill-sky-900/50" : "fill-muted"}
      />
      <g className={blue ? "fill-sky-500/45" : "fill-foreground/10"}>
        <path d="M120 96c14-18 40-24 62-14 12 6 14 20 6 30-10 12-30 8-44 16-16 10-38-14-24-32z" />
        <path d="M230 70c18-8 42-2 52 14 6 10-2 22-14 24-16 2-26 14-42 10-14-4-16-38 4-48z" />
        <path d="M300 118c12-4 28 4 30 16 2 10-8 20-20 20-14 0-26-12-22-26 2-6 6-8 12-10z" />
        <path d="M160 140c10-6 26-4 32 6 6 12-4 26-18 26-12 0-24-10-22-22 1-4 4-8 8-10z" />
        <path d="M70 150c8-8 24-6 30 4 4 8-2 18-12 20-10 2-22-4-22-14 0-4 1-7 4-10z" />
      </g>
      <g
        className={blue ? "stroke-sky-500/20" : "stroke-foreground/8"}
        fill="none"
        strokeWidth="1"
      >
        <ellipse cx="210" cy="230" rx="200" ry="70" />
        <ellipse cx="210" cy="230" rx="200" ry="140" />
        <ellipse cx="210" cy="230" rx="90" ry="200" />
        <ellipse cx="210" cy="230" rx="160" ry="200" />
      </g>
    </svg>
  );
}
