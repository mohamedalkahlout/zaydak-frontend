"use client"

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import Image from "@/shared/components/app-image"
interface OrdersEmptyProps {
  hasFilters?: boolean;
  /** Standalone = used when there are truly 0 orders (no toolbar above). */
  standalone?: boolean;
}

export function OrdersEmpty({ hasFilters, standalone }: OrdersEmptyProps) {
  const t = useTranslations("orders.list");
  // Filtered-to-zero: compact state that lives inside the existing card/toolbar.
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <InboxIllustration className="size-24 opacity-60" />
        <h2 className="mt-4 text-base font-semibold">{t("noMatching")}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("noMatchingBody")}
        </p>
      </div>
    );
  }

  // Truly-empty: big Shopify-style card with illustration + CTA.
  const content = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 pt-16 pb-8 text-center">
      <Image
        src="/empty-state-orders.svg"
        alt=""
        width={226}
        height={226}
        className=""
      />
      <h2 className="mt-6 text-lg font-semibold">{t("emptyTitle")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("emptyBody")}
      </p>
      <Button className="mt-6 h-9 rounded-lg">{t("selectPlan")}</Button>
    </div>
  );

  if (!standalone) return content;

  return (
    <div className="flex flex-col gap-4">
      {content}
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="https://help.shopify.com/manual/orders"
          className="underline-offset-4 hover:underline"
        >
          {t("learnMore")}
        </Link>
      </p>
    </div>
  );
}

function InboxIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Paper sticking out of the inbox */}
      <rect
        x="34"
        y="20"
        width="60"
        height="74"
        rx="4"
        fill="white"
        stroke="#d1d5db"
        strokeWidth="1.5"
      />
      {/* Content bars on the document */}
      <rect x="42" y="30" width="34" height="6" rx="2" fill="#3b82f6" />
      <rect x="42" y="44" width="44" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="42" y="51" width="44" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="42" y="58" width="30" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="42" y="72" width="24" height="10" rx="2" fill="#f97316" />

      {/* Teal inbox tray */}
      <path
        d="M16 78 L28 62 L48 62 L52 72 L76 72 L80 62 L100 62 L112 78 L112 100 Q112 108 104 108 L24 108 Q16 108 16 100 Z"
        fill="#0d9488"
      />
      {/* Subtle inner shadow on the tray */}
      <path
        d="M16 78 L28 62 L48 62 L52 72 L76 72 L80 62 L100 62 L112 78"
        stroke="#0f766e"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
