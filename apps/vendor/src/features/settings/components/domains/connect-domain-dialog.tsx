"use client";

import { useId, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";

import { CONNECT_SHOP_DOMAIN, SHOP_DOMAINS } from "../../api/domains";

/**
 * "Connect existing domain" — the merchant types a domain they already own.
 *
 * One field and a Next, which is the whole of the design it mirrors, and the
 * restraint is the point: everything that could be asked here (is it an apex or
 * a subdomain? which registrar? A record or CNAME?) is something the server can
 * work out from the hostname, and asking a merchant a DNS question is how a
 * connect flow loses the people who most need it to be simple.
 *
 * **Validation is deliberately thin on this side.** The server normalises
 * (`normalizeCustomHostname`) and owns every rule — uniqueness, the platform
 * apex, label shape — so a mirror here would be a second copy that disagrees.
 * What the client checks is only what makes the button meaningful: that
 * something was typed and that it has a dot in it. Everything else arrives as a
 * server message, which is also the only way the merchant hears about a domain
 * that is already connected.
 */
export function ConnectDomainDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The new domain's id, so the pane can open its setup instructions. */
  onConnected: (id: string) => void;
}) {
  const t = useTranslations("settings.domains.connect");
  const inputId = useId();
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [connect, { loading }] = useMutation(CONNECT_SHOP_DOMAIN, {
    // The table is the thing this changes, and it is on screen behind the
    // dialog — refetching is cheaper to reason about than writing the new row
    // into the cache by hand for a list that is never more than a few entries.
    refetchQueries: [{ query: SHOP_DOMAINS }],
    awaitRefetchQueries: true,
  });

  // Not a validation rule, a "is the button worth pressing" rule — see above.
  const looksLikeDomain = hostname.trim().includes(".");

  function close() {
    setHostname("");
    setError(null);
    onOpenChange(false);
  }

  async function submit() {
    if (!looksLikeDomain || loading) return;
    setError(null);
    try {
      const { data } = await connect({
        variables: { hostname: hostname.trim() },
      });
      const id = (
        data as { connectShopDomain?: { data?: { id?: string } } } | undefined
      )?.connectShopDomain?.data?.id;
      close();
      if (id) onConnected(id);
    } catch (err) {
      // Shown in place rather than as a toast: the merchant is looking at the
      // field that caused it and the dialog stays open so they can correct it.
      setError((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("body")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t("label")}
          </label>
          <Input
            id={inputId}
            value={hostname}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("placeholder")}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setHostname(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="h-11 rounded-lg text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!looksLikeDomain || loading}
          >
            {loading ? t("connecting") : t("next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
