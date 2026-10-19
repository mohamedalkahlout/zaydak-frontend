"use client";

import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

/**
 * Where a merchant can buy a domain. Plain outbound links, in alphabetical
 * order — the platform has no relationship with any of them and takes
 * nothing from a purchase, which is what keeps the list honest.
 */
const REGISTRARS = [
  {
    key: "cloudflare",
    name: "Cloudflare Registrar",
    href: "https://www.cloudflare.com/products/registrar/",
  },
  { key: "godaddy", name: "GoDaddy", href: "https://www.godaddy.com/domains" },
  {
    key: "namecheap",
    name: "Namecheap",
    href: "https://www.namecheap.com/domains/",
  },
];

/**
 * "Buy new domain" — the header's primary action, and what it can honestly do.
 *
 * The platform does not sell domains, so the button opens this rather than a
 * checkout: where to buy one, and the one thing to do afterwards, which is to
 * come back and connect it. A merchant who already owns a domain is one click
 * from the connect dialog instead, because "buy" is the button people press
 * when they mean "I want my own domain on this store".
 */
export function BuyDomainDialog({
  open,
  onOpenChange,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Close this and open "Connect existing domain". */
  onConnect: () => void;
}) {
  const t = useTranslations("settings.domains.buy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("registrars")}</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {REGISTRARS.map((registrar) => (
              <li key={registrar.key}>
                <a
                  href={registrar.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">{registrar.name}</span>
                  <ExternalLinkIcon className="size-4 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t("then")}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
          <Button type="button" onClick={onConnect}>
            {t("connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
