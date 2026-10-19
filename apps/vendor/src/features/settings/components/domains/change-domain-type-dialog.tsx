"use client";

import { useId, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { cn } from "@/shared/lib/utils";

import {
  CLEAR_PRIMARY_SHOP_DOMAIN,
  SET_PRIMARY_SHOP_DOMAIN,
  SHOP_DOMAINS,
} from "../../api/domains";
import type { DomainStatus } from "../../lib/domain-status";

/**
 * What an address does, once a shop has more than one.
 *
 * `primary` is the address the shop's links are built from. `redirect` is an
 * address that bounces to a *custom* primary. `alias` is an address that
 * serves the store without redirecting — which is what every non-primary
 * address does while the platform subdomain is still primary, since the
 * storefront only ever redirects to a custom domain that is live.
 */
export type DomainType = "primary" | "redirect" | "alias";

export interface DomainTypeTarget {
  /**
   * `PLATFORM_DOMAIN_ID` for the platform subdomain, which has no row.
   *
   * The dialog never passes it to a mutation — promoting that address is
   * `clearPrimaryShopDomain`, which takes no argument precisely because there
   * is nothing to name.
   */
  id: string;
  hostname: string;
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM";
  status: DomainStatus;
  is_primary: boolean;
}

/**
 * "Change domain type for {hostname}" — one radio per type, the current one
 * marked, and a confirm that only enables once a different type is chosen.
 *
 * Two changes are possible, and which mutation runs depends on **which address
 * is being promoted** rather than on which option is picked:
 *
 *   - promote a custom domain → `setPrimaryShopDomain(id)`;
 *   - promote the platform subdomain → `clearPrimaryShopDomain()`, which takes
 *     no argument because that address has no row to name. Clearing every
 *     custom primary flag *is* promoting it, since "no primary row" has always
 *     meant "the platform address is the shop's address".
 *
 * That second one is why a primary custom domain can now be demoted at all.
 * Before it existed the only way back was deleting the domain — which a
 * merchant staging a migration, or backing one out, does not want to do — so
 * the `redirect` option was drawn permanently disabled with a note explaining
 * that another domain had to be promoted first.
 *
 * Both directions are confirmed here because both change every link the
 * merchant has ever shared. A domain that is not yet serving still cannot be
 * promoted — the server refuses with `DOMAIN_NOT_ACTIVE` — so that option says
 * so and stays disabled; the platform address has no such gate, because it is
 * the one address the platform itself guarantees.
 */
export function ChangeDomainTypeDialog({
  domain,
  currentType,
  onOpenChange,
}: {
  domain: DomainTypeTarget | null;
  /** What the address does today, as the target card reads it. */
  currentType: DomainType;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.domains.type");
  const groupId = useId();

  // Both write the same thing from the reader's point of view — which address
  // the shop's links are built from — so both refetch the list and both block
  // the confirm while they run.
  const refetch = {
    refetchQueries: [{ query: SHOP_DOMAINS }],
    awaitRefetchQueries: true,
  };
  const [setPrimary, { loading: promoting }] = useMutation(
    SET_PRIMARY_SHOP_DOMAIN,
    refetch,
  );
  const [clearPrimary, { loading: demoting }] = useMutation(
    CLEAR_PRIMARY_SHOP_DOMAIN,
    refetch,
  );
  const loading = promoting || demoting;

  // The domain last shown, kept through the close animation so the title and
  // the options do not change while the dialog is still on screen; and the
  // selection, re-seeded from the current type whenever a different domain
  // opens the dialog. Both adjusted during render rather than in an effect.
  const [shown, setShown] = useState(domain);
  const [selected, setSelected] = useState<DomainType>(currentType);
  if (domain && domain !== shown) {
    setShown(domain);
    setSelected(currentType);
  }

  const isPlatform = shown?.kind === "PLATFORM_SUBDOMAIN";
  // The platform address is not gated on a status check: it is the address the
  // platform itself serves, and its `status` reflects whether the *storefront*
  // is open rather than whether DNS reaches it.
  const active = isPlatform || shown?.status === "ACTIVE";
  const isPrimary = shown?.is_primary ?? false;

  const options: {
    value: DomainType;
    disabled: boolean;
    note?: string;
  }[] = [
    {
      value: "primary",
      disabled: isPrimary || !active,
      note: !isPrimary && !active ? t("needsConnected") : undefined,
    },
    isPrimary
      ? {
          // A primary custom domain can be stepped down now: promoting the
          // platform address is what demoting this one means, and that is one
          // mutation rather than an alias flag. The platform row itself cannot
          // — there is nothing left to hand primacy to.
          value: "redirect",
          disabled: isPlatform,
          note: isPlatform ? t("platformAlwaysServes") : t("stepDownHint"),
        }
      : { value: currentType, disabled: false },
  ];

  const canConfirm =
    selected !== currentType &&
    (selected === "primary" ? active : isPrimary && !isPlatform) &&
    !loading;

  async function confirm() {
    if (!domain || !canConfirm) return;
    try {
      // Promoting the platform address and demoting a custom one are the same
      // write, reached from either end of the dialog — which is exactly why
      // `clearPrimaryShopDomain` takes no id.
      if (selected === "primary" && domain.kind === "CUSTOM") {
        await setPrimary({ variables: { id: domain.id } });
      } else {
        await clearPrimary();
      }
      sileo.success({ title: t("changed"), description: domain.hostname });
      onOpenChange(false);
    } catch (err) {
      sileo.error({ title: (err as Error).message });
    }
  }

  return (
    <Dialog open={domain !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t.rich("title", {
              hostname: shown?.hostname ?? "",
              ltr: (chunks) => <span dir="ltr">{chunks}</span>,
            })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(value) => setSelected(value as DomainType)}
          aria-labelledby={groupId}
          className="gap-5"
        >
          {options.map((option) => {
            const id = `${groupId}-${option.value}`;
            const current = option.value === currentType;
            return (
              <div key={option.value} className="flex items-start gap-3">
                <RadioGroupItem
                  id={id}
                  value={option.value}
                  disabled={option.disabled}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <label
                    htmlFor={id}
                    className={cn(
                      "text-sm font-medium",
                      option.disabled && "text-muted-foreground",
                    )}
                  >
                    {t(option.value)}
                    {current && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        {t("current")}
                      </span>
                    )}
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`${option.value}Hint`)}
                  </p>
                  {option.note && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>

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
            onClick={() => void confirm()}
            disabled={!canConfirm}
          >
            {loading ? t("saving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What an address does today, read from the whole list.
 *
 * The storefront only redirects to a custom domain that is live
 * (`primaryHostname` requires ACTIVE), so a non-primary address redirects
 * exactly when such a domain exists and is not itself — and otherwise serves
 * the store on its own, which is the alias behaviour.
 */
export function domainTypeOf(
  row: { is_primary: boolean; hostname: string },
  rows: readonly {
    kind: "PLATFORM_SUBDOMAIN" | "CUSTOM";
    is_primary: boolean;
    status: DomainStatus;
    hostname: string;
  }[],
): { type: DomainType; redirectTarget: string | null } {
  if (row.is_primary) return { type: "primary", redirectTarget: null };
  const target = rows.find(
    (entry) =>
      entry.kind === "CUSTOM" &&
      entry.is_primary &&
      entry.status === "ACTIVE" &&
      entry.hostname !== row.hostname,
  );
  return target
    ? { type: "redirect", redirectTarget: target.hostname }
    : { type: "alias", redirectTarget: null };
}
