"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { sileo } from "sileo";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { REMOVE_SHOP_DOMAIN, SHOP_DOMAINS } from "../../api/domains";

/**
 * "Delete {hostname}?" — one confirm, shared by the table's trash icon and the
 * detail screen's Domain settings menu, so the two cannot describe the
 * outcome differently.
 *
 * It confirms because the effect is customer-facing and immediate: the moment
 * the row is gone, anyone opening the address reaches nothing. The copy says
 * exactly that rather than "are you sure", and says the domain can be
 * connected again, because that is what would otherwise stop a merchant who
 * connected the wrong one from fixing it.
 */
export function DeleteDomainDialog({
  domain,
  onOpenChange,
  onDeleted,
}: {
  /** The row to delete, or null while the dialog is closed. */
  domain: { id: string; hostname: string } | null;
  onOpenChange: (open: boolean) => void;
  /** Runs after the row is gone — the detail screen leaves; the table stays. */
  onDeleted?: (id: string) => void;
}) {
  const t = useTranslations("settings.domains.remove");

  const [remove, { loading }] = useMutation(REMOVE_SHOP_DOMAIN, {
    refetchQueries: [{ query: SHOP_DOMAINS }],
  });

  // The domain last shown, kept through the close animation so the title
  // does not blank out while the dialog is still on screen. Adjusted during
  // render rather than in an effect.
  const [shown, setShown] = useState(domain);
  if (domain && domain !== shown) setShown(domain);

  async function confirm() {
    if (!domain || loading) return;
    try {
      await remove({ variables: { id: domain.id } });
      sileo.success({ title: t("done"), description: domain.hostname });
      onOpenChange(false);
      onDeleted?.(domain.id);
    } catch (err) {
      sileo.error({ title: (err as Error).message });
    }
  }

  return (
    <Dialog open={domain !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t.rich("title", {
              hostname: shown?.hostname ?? "",
              ltr: (chunks) => <span dir="ltr">{chunks}</span>,
            })}
          </DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirm()}
            disabled={loading}
          >
            {loading ? t("deleting") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
