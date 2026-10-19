"use client";

import { GlobeIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * A brand-coloured monogram for the company that runs a domain's DNS.
 *
 * A letter on a tinted square rather than a logo, on purpose: the detector
 * knows a dozen providers and the list will grow, and a logo per provider is a
 * trademark asset to license, size and keep current for each. The colour is
 * the provider's own, so GoDaddy still reads as GoDaddy at a glance, and an
 * unrecognised provider gets a plain globe rather than a guess.
 */
const BRAND: Record<string, string> = {
  GODADDY: "bg-[#1bdbdb]/20 text-[#0b7d7d]",
  CLOUDFLARE: "bg-[#f38020]/15 text-[#c2590a]",
  NAMECHEAP: "bg-[#de3723]/12 text-[#b8261a]",
  HOSTINGER: "bg-[#673de6]/12 text-[#5028c7]",
  AWS_ROUTE53: "bg-[#ff9900]/15 text-[#b36b00]",
  SQUARESPACE: "bg-neutral-900/10 text-neutral-800 dark:text-neutral-200",
  VERCEL: "bg-neutral-900/10 text-neutral-900 dark:text-neutral-100",
  DIGITALOCEAN: "bg-[#0080ff]/12 text-[#005cb8]",
  PORKBUN: "bg-[#ef7c8e]/15 text-[#c24a5f]",
  NAME_COM: "bg-[#2b6cb0]/12 text-[#1f4f82]",
  GANDI: "bg-[#00ba91]/15 text-[#007d61]",
  OVH: "bg-[#000e9c]/10 text-[#000e9c] dark:text-[#8a94ff]",
};

export function DomainProviderMark({
  provider,
  name,
  className,
}: {
  /** The detector's stable key, e.g. `GODADDY`. */
  provider: string;
  /** What the merchant is shown, or null when detection was inconclusive. */
  name?: string | null;
  className?: string;
}) {
  const tone = BRAND[provider];
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold",
        tone ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {initial && tone ? initial : <GlobeIcon className="size-4" />}
    </span>
  );
}
